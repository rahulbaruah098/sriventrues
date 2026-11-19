"""SRI careers: private resumes, explainable screening, and managed recruitment."""
import io
import os
import re
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.exceptions import BadRequest, Conflict, NotFound

from ..auth import admin_required, rate_limit
from ..core import db, email as valid_email, now
from ..mail import deliver

careers = Blueprint('careers', __name__)
KINDS = ('received', 'reviewing', 'shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'rejected', 'on_hold')
TEXT = {'title': 160, 'department': 100, 'location': 160, 'employment_type': 50, 'education': 3000,
        'experience': 120, 'description': 9000, 'responsibilities': 9000, 'required_skills': 1200,
        'preferred_skills': 1200, 'salary': 120, 'deadline': 10, 'interview_mode': 70,
        'interview_location': 350, 'interview_at': 35, 'notes': 3000}


def iso(v):
    return v.isoformat().replace('+00:00', 'Z') if isinstance(v, datetime) else v


def clean(v, maxlen=300, required=False):
    if not isinstance(v, str) or len(v) > maxlen or '\x00' in v:
        raise BadRequest('Invalid text field.')
    v = v.strip()
    if required and not v:
        raise BadRequest('A required field is missing.')
    return v


def oid(value):
    if not ObjectId.is_valid(value):
        raise NotFound('Record not found.')
    return ObjectId(value)


def convert(v):
    if isinstance(v, ObjectId): return str(v)
    if isinstance(v, datetime): return iso(v)
    if isinstance(v, list): return [convert(x) for x in v]
    if isinstance(v, dict): return {k:convert(x) for k,x in v.items() if k not in ('resume_path','resume_text','password_token')}
    return v

def j(doc):
    if not doc: return None
    d=convert(doc)
    d['id']=d.pop('_id')
    return d


def active(doc):
    return doc['status'] == 'published' and (not doc.get('deadline') or doc['deadline'] >= now().date().isoformat())


def send_event(address, subject, message, app_id, kind):
    """Record outcome and never treat a failed email as successful."""
    host = smtp_settings()
    sent = False
    if host.get('host') and host.get('from'):
        mail = EmailMessage()
        mail['From'] = host['from']
        mail['To'] = address
        mail['Subject'] = subject
        mail.set_content(message)
        import smtplib
        import ssl
        try:
            if host['mode'] == 'ssl':
                conn = smtplib.SMTP_SSL(host['host'], int(host['port']), timeout=7, context=ssl.create_default_context())
            else:
                conn = smtplib.SMTP(host['host'], int(host['port']), timeout=7)
            with conn as smtp:
                if host['mode'] == 'starttls': smtp.starttls(context=ssl.create_default_context())
                if host['user']: smtp.login(host['user'], host['password'])
                smtp.send_message(mail)
            sent = True
        except (OSError, smtplib.SMTPException):
            current_app.logger.warning('Careers SMTP delivery did not complete.')
    db().career_emails.insert_one({'application_id':app_id, 'kind':kind, 'to':address,
        'subject':subject, 'body':message, 'status':'sent' if sent else 'failed', 'created_at':now()})
    return sent


def smtp_settings():
    d = db().career_smtp.find_one({'_id':'main'}) or {}
    env = current_app.config
    secret = ''
    if d.get('password_token'):
        from cryptography.fernet import Fernet, InvalidToken
        key = os.getenv('CAREERS_SMTP_KEY', '')
        if not key:
            raise RuntimeError('CAREERS_SMTP_KEY must be configured to use saved SMTP credentials')
        try:
            secret = Fernet(key.encode()).decrypt(d['password_token'].encode()).decode()
        except (ValueError, InvalidToken) as exc:
            raise RuntimeError('CAREERS_SMTP_KEY does not decrypt saved credentials') from exc
    return {
        'host':d.get('host') or env.get('SMTP_HOST',''),
        'port':d.get('port') or env.get('SMTP_PORT',587),
        'mode':d.get('mode') or env.get('SMTP_MODE','starttls'),
        'user':d.get('user') or env.get('SMTP_USER',''),
        'password': secret or env.get('SMTP_PASSWORD',''),
        'from':d.get('from') or env.get('SMTP_FROM',''),
    }


def mail_template(kind, candidate, job, details=''):
    first = candidate.get('name','Candidate')
    label = job.get('title','the role')
    messages = {
      'received': ('Application received — SRI Ventures & Consulting', f'Dear {first},\n\nThank you for applying for {label}. We have received your application and will review it.\n\nRegards,\nSRI Recruitment Team'),
      'shortlisted': (f'Shortlisted — {label}', f'Dear {first},\n\nYour application for {label} has been shortlisted for further consideration. We will contact you with the next steps.\n\nRegards,\nSRI Recruitment Team'),
      'interview_scheduled': (f'Interview invitation — {label}', f'Dear {first},\n\nYou are invited to an interview for {label}.\n\n{details}\n\nPlease reply to confirm your availability.\n\nRegards,\nSRI Recruitment Team'),
      'selected': (f'Selection update — {label}', f'Dear {first},\n\nWe are pleased to inform you that you have been selected for {label}. Our team will contact you regarding next steps. This notification is not an employment offer or contract.\n\nRegards,\nSRI Recruitment Team'),
      'rejected': (f'Application update — {label}', f'Dear {first},\n\nThank you for your interest in {label}. We will not be progressing your application further at this time.\n\nRegards,\nSRI Recruitment Team')
    }
    default = messages.get(kind)
    if not default: return None
    template = db().career_templates.find_one({'_id':kind}) or {}
    replacements = {'{name}':first, '{job_title}':label, '{interview_details}':details,
        '{company}':'SRI Ventures & Consulting Pvt. Ltd.'}
    subject = template.get('subject') or default[0]
    body = template.get('body') or default[1]
    for key,value in replacements.items():
        subject=subject.replace(key,value)
        body=body.replace(key,value)
    return subject,body


def parse_bytes(upload):
    name = (upload.filename or '').lower()
    raw = upload.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024 or len(raw) == 0:
        raise BadRequest('Choose a resume up to 5 MB.')
    try:
        if name.endswith('.pdf') and raw.startswith(b'%PDF-'):
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw), strict=False)
            if reader.is_encrypted or len(reader.pages) > 35:
                raise BadRequest('Use a readable, unencrypted PDF of up to 35 pages.')
            text = '\n'.join((p.extract_text() or '') for p in reader.pages)
            ext = 'pdf'
        elif name.endswith('.docx') and raw[:2] == b'PK':
            import zipfile
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                members=archive.infolist()
                if len(members)>300 or sum(x.file_size for x in members)>20*1024*1024:
                    raise BadRequest('This DOCX is too large to process safely.')
            from docx import Document
            doc = Document(io.BytesIO(raw))
            text = '\n'.join(p.text for p in doc.paragraphs)
            text += '\n' + '\n'.join(c.text for t in doc.tables for row in t.rows for c in row.cells)
            ext = 'docx'
        else:
            raise BadRequest('Only genuine PDF and DOCX resumes are accepted.')
    except BadRequest:
        raise
    except Exception as exc:
        raise BadRequest('Could not read this resume. Please upload a valid PDF or DOCX.') from exc
    return raw, ext, text[:120000]


def parsed_fields(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name = next((x for x in lines[:6] if 3 <= len(x) <= 80 and re.fullmatch(r"[A-Za-z][A-Za-z .'-]+", x)), '')
    m = re.search(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', text, flags=re.I)
    phone = re.search(r'(?<!\d)(?:\+91[-\s]?)?[6-9]\d{9}(?!\d)', re.sub(r'[ ()-]', '', text))
    sections={'education':[], 'experience':[], 'skills':[]}
    labels={
      'education':r'^(education|academic qualifications?|academics?|qualifications?)\s*:?$',
      'experience':r'^(work experience|professional experience|employment history|experience)\s*:?$',
      'skills':r'^(skills|technical skills|core competencies|key skills|expertise)\s*:?$',
    }
    active_section=None
    for line in lines[:250]:
        matched=next((k for k,pattern in labels.items() if re.match(pattern,line,re.I)),None)
        if matched:
            active_section=matched
            continue
        if re.match(r'^[A-Z][A-Z /&-]{3,45}:?$',line) and len(line.split())<=5:
            active_section=None
        if active_section and sum(map(len,sections[active_section]))<1500:
            sections[active_section].append(line)
    # Only populate fields from identifiable resume sections; never invent entries.
    return {'name':name, 'email':m.group(0) if m else '', 'phone':phone.group(0) if phone else '',
            'education':'\n'.join(sections['education'])[:1500],
            'experience':'\n'.join(sections['experience'])[:1500],
            'skills':'\n'.join(sections['skills'])[:1500], 'location':''}


def match_score(job, app):
    """Advisory, transparent keyword coverage; never auto-reject or infer protected attributes."""
    required = [s.strip().lower() for s in re.split('[,;\n]',job.get('required_skills','')) if s.strip()][:35]
    preferred = [s.strip().lower() for s in re.split('[,;\n]',job.get('preferred_skills','')) if s.strip()][:35]
    hay = (app.get('skills','')+' '+app.get('experience','')+' '+app.get('resume_text','')).lower()
    found = [s for s in required if s in hay]
    bonus = [s for s in preferred if s in hay]
    # Do not infer suitability from education, name, age, gender or photos.
    if not required and not preferred:
        return {'score':None, 'matched_skills':[], 'missing_skills':[], 'explanation':'No scored skills configured for this job.'}
    denom = (len(required)*0.8 + len(preferred)*0.2) or 1
    score = round(100*(0.8*len(found)+0.2*len(bonus))/denom)
    return {'score':min(100,score), 'matched_skills':found+bonus,
            'missing_skills':[s for s in required if s not in found],
            'explanation':'Keyword overlap only; human review required. A missing keyword does not mean the candidate lacks the skill.'}


@careers.get('/api/public/careers/jobs')
def jobs_public():
    result = [j(x) for x in db().career_jobs.find({'status':'published'}).sort('published_at',-1).limit(150) if active(x)]
    return {'items':result}


@careers.get('/api/public/careers/jobs/<job_id>')
def job_public(job_id):
    item=db().career_jobs.find_one({'_id':oid(job_id)})
    if not item or not active(item): raise NotFound('This vacancy is not available.')
    return j(item)


@careers.post('/api/public/careers/parse')
def parse_public():
    rate_limit('careers-parse',12,3600)
    upload=request.files.get('resume')
    if upload is None: raise BadRequest('Upload a resume.')
    raw, ext, text = parse_bytes(upload)
    return {'fields':parsed_fields(text), 'message':'Review and correct each field before applying. Scanned PDFs may require manual entry.'}


@careers.post('/api/public/careers/apply/<job_id>')
def apply(job_id):
    rate_limit('careers-apply-ip',8,3600)
    job=db().career_jobs.find_one({'_id':oid(job_id)})
    if not job or not active(job): raise NotFound('This vacancy is closed.')
    upload=request.files.get('resume')
    if not upload: raise BadRequest('A resume is required.')
    raw, ext, text = parse_bytes(upload)
    f=request.form
    if f.get('website','').strip(): raise BadRequest('Invalid submission.')
    if f.get('consent') != 'true': raise BadRequest('Consent to applicant data processing is required.')
    candidate={key:clean(f.get(key,''), cap, required=(key in ('name','email','phone')))
              for key,cap in {'name':130,'email':254,'phone':40,'location':180,
                              'education':2200,'experience':3500,'skills':2000}.items()}
    candidate['email']=valid_email(candidate['email'])
    existing=db().career_applications.find_one({'job_id':job['_id'], 'email':candidate['email']})
    if existing: raise Conflict('An application from this email address already exists for this vacancy.')
    stamp=now()
    folder=Path(current_app.config['MEDIA_DIR']).parent/'private-career-resumes'
    folder.mkdir(parents=True,exist_ok=True)
    file_name=uuid.uuid4().hex+'.'+ext
    path=folder/file_name
    path.write_bytes(raw)
    try:
        record={**candidate,'job_id':job['_id'], 'job_title':job['title'], 'job_published_at':job.get('published_at'),
                'status':'received','resume_filename':clean(upload.filename or 'Resume',180), 'resume_path':str(path),
                'resume_text':text,'created_at':stamp,'updated_at':stamp,'consent_at':stamp,
                'history':[{'status':'received','at':stamp,'note':'Application submitted'}]}
        record.update(match_score(job,record))
        result=db().career_applications.insert_one(record)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    subject,body=mail_template('received',record,job)
    sent=send_event(record['email'],subject,body,result.inserted_id,'received')
    return {'id':str(result.inserted_id),'message':'Application submitted successfully.', 'acknowledgement_email_sent':sent},201


@careers.get('/api/admin/careers/jobs')
@admin_required
def jobs_admin():
    return {'items':[j(x) for x in db().career_jobs.find().sort('created_at',-1).limit(400)]}


@careers.post('/api/admin/careers/jobs')
@admin_required
def create_job():
    data=request.get_json(silent=True) or {}
    if not isinstance(data,dict): raise BadRequest('Invalid job details.')
    row={k:clean(data.get(k,''),cap,required=k in ('title','department','description')) for k,cap in TEXT.items() if k not in ('interview_mode','interview_location','interview_at','notes')}
    count=data.get('vacancies',1)
    if isinstance(count,bool) or not str(count).isdigit() or not 1<=int(count)<=1000: raise BadRequest('Invalid vacancy count.')
    row['vacancies']=int(count)
    row['status']='draft'; row['created_at']=now();row['updated_at']=now();row['published_at']=None
    x=db().career_jobs.insert_one(row)
    db().career_jobs.update_one({'_id':x.inserted_id},{'$set':{'reference':'SRI-JOB-'+str(x.inserted_id)[-8:].upper()}})
    return {'item':j(db().career_jobs.find_one({'_id':x.inserted_id}))},201


@careers.put('/api/admin/careers/jobs/<job_id>')
@admin_required
def update_job(job_id):
    d=request.get_json(silent=True) or {}
    if not isinstance(d,dict): raise BadRequest('Invalid job details.')
    allowed={'draft','published','inactive','closed'}
    row={k:clean(d[k],cap,required=k in ('title','department','description')) for k,cap in TEXT.items() if k in d and k not in ('interview_mode','interview_location','interview_at','notes')}
    if 'status' in d:
        if d['status'] not in allowed: raise BadRequest('Invalid publication status.')
        row['status']=d['status']
    if 'vacancies' in d:
        if isinstance(d['vacancies'],bool) or not str(d['vacancies']).isdigit() or not 1<=int(d['vacancies'])<=1000: raise BadRequest('Invalid vacancy count.')
        row['vacancies']=int(d['vacancies'])
    original=db().career_jobs.find_one({'_id':oid(job_id)})
    if not original: raise NotFound('Job not found.')
    if d.get('status') == 'published' and not original.get('published_at'):
        row['published_at']=now()
    row['updated_at']=now()
    db().career_jobs.update_one({'_id':original['_id']},{'$set':row})
    return {'item':j(db().career_jobs.find_one({'_id':original['_id']}))}


@careers.get('/api/admin/careers/applications')
@admin_required
def applications_admin():
    q={}
    if request.args.get('job_id'):q['job_id']=oid(request.args['job_id'])
    if request.args.get('status'):q['status']=request.args['status']
    if request.args.get('from'):
        try: q.setdefault('created_at',{})['$gte']=datetime.fromisoformat(request.args['from']).replace(tzinfo=timezone.utc)
        except ValueError: raise BadRequest('Invalid start date.')
    if request.args.get('to'):
        try: q.setdefault('created_at',{})['$lte']=datetime.fromisoformat(request.args['to']+'T23:59:59+00:00')
        except ValueError: raise BadRequest('Invalid end date.')
    items=[]
    for x in db().career_applications.find(q,{'resume_text':0,'resume_path':0}).sort('created_at',-1).limit(500):
        d=j(x);d['job_id']=str(x['job_id']);items.append(d)
    return {'items':items}



@careers.get('/api/admin/careers/applications/<app_id>')
@admin_required
def application_detail(app_id):
    x=db().career_applications.find_one({'_id':oid(app_id)})
    if not x:raise NotFound('Application not found.')
    return {'item':j(x)}

@careers.get('/api/admin/careers/applications/<app_id>/resume')
@admin_required
def download_resume(app_id):
    x=db().career_applications.find_one({'_id':oid(app_id)})
    if not x:raise NotFound('Application not found.')
    path=Path(x['resume_path'])
    if not path.is_file():raise NotFound('Resume file is missing.')
    ext=path.suffix.lower()
    return send_file(path,as_attachment=True,download_name=('SRI-Resume-'+str(x['_id'])+ext),mimetype='application/pdf' if ext=='.pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')


@careers.put('/api/admin/careers/applications/<app_id>')
@admin_required
def update_application(app_id):
    d=request.get_json(silent=True) or {}
    status=d.get('status')
    if status not in KINDS:raise BadRequest('Invalid recruitment status.')
    row=db().career_applications.find_one({'_id':oid(app_id)})
    if not row:raise NotFound('Application not found.')
    updates={'status':status,'updated_at':now(), 'notes':clean(d.get('notes',''),3000)}
    details=''
    if status=='interview_scheduled':
        for key in ('interview_at','interview_mode','interview_location'):
            updates[key]=clean(d.get(key,''),TEXT[key],required=True)
        try:
            meeting=datetime.fromisoformat(updates['interview_at'].replace('Z','+00:00'))
            if meeting.tzinfo is None:raise ValueError()
        except ValueError:raise BadRequest('Interview date/time must have a timezone.')
        if meeting <= now():raise BadRequest('Interview must be scheduled in the future.')
        details=f"Date/time: {updates['interview_at']}\nMode: {updates['interview_mode']}\nVenue/link: {updates['interview_location']}"
    db().career_applications.update_one({'_id':row['_id']},{'$set':updates,'$push':{'history':{'status':status,'at':now(),'note':updates['notes']}}})
    job=db().career_jobs.find_one({'_id':row['job_id']}) or {'title':row.get('job_title','the position')}
    event=mail_template(status,row,job,details) if status!=row['status'] or (status=='interview_scheduled' and d.get('send_email')) else None
    sent=None
    if event and d.get('send_email',True):sent=send_event(row['email'],*event,row['_id'],status)
    return {'item':j(db().career_applications.find_one({'_id':row['_id']})), 'email_sent':sent}


@careers.get('/api/admin/careers/emails')
@admin_required
def email_log():
    records=[]
    for x in db().career_emails.find().sort('created_at',-1).limit(250):
        d=j(x);d['application_id']=str(x['application_id']);records.append(d)
    return {'items':records}


@careers.get('/api/admin/careers/smtp')
@admin_required
def smtp_get():
    info=smtp_settings()
    return {k:info[k] for k in ('host','port','mode','user','from')} | {'password_configured':bool(info.get('password'))}


@careers.put('/api/admin/careers/smtp')
@admin_required
def smtp_put():
    d=request.get_json(silent=True) or {}
    host=clean(d.get('host',''),180)
    sender=valid_email(d.get('from','')) if host else ''
    mode=d.get('mode','starttls')
    if mode not in ('ssl','starttls'):raise BadRequest('TLS encryption is required.')
    port=d.get('port',587)
    if isinstance(port,bool) or not str(port).isdigit() or not 1<=int(port)<=65535:raise BadRequest('Invalid SMTP port.')
    update={'host':host,'from':sender,'mode':mode,'port':int(port),'user':clean(d.get('user',''),180),'updated_at':now()}
    if d.get('password'):
        from cryptography.fernet import Fernet
        key=os.getenv('CAREERS_SMTP_KEY','')
        if not key: raise BadRequest('Set CAREERS_SMTP_KEY in backend/.env before saving a password.')
        try: update['password_token']=Fernet(key.encode()).encrypt(clean(d['password'],300).encode()).decode()
        except ValueError as exc: raise BadRequest('Invalid CAREERS_SMTP_KEY.') from exc
    db().career_smtp.update_one({'_id':'main'},{'$set':update},upsert=True)
    return {'ok':True}


@careers.post('/api/admin/careers/smtp/test')
@admin_required
def smtp_test():
    d=request.get_json(silent=True) or {}
    address=valid_email(d.get('to',''))
    sent=send_event(address,'SRI Careers SMTP test','This is an SMTP test from SRI Careers.',None,'smtp_test')
    return {'sent':sent}


@careers.get('/api/admin/careers/templates')
@admin_required
def templates_get():
    kinds=('received','shortlisted','interview_scheduled','selected','rejected')
    items=[]
    for kind in kinds:
        document=db().career_templates.find_one({'_id':kind}) or {}
        items.append({'kind':kind,'subject':document.get('subject',''),'body':document.get('body','')})
    return {'items':items}


@careers.put('/api/admin/careers/templates/<kind>')
@admin_required
def templates_update(kind):
    if kind not in ('received','shortlisted','interview_scheduled','selected','rejected'):
        raise NotFound('Template not found.')
    d=request.get_json(silent=True) or {}
    subject=clean(d.get('subject',''),180)
    body=clean(d.get('body',''),6000)
    db().career_templates.update_one({'_id':kind},{'$set':{'subject':subject,'body':body,'updated_at':now()}},upsert=True)
    return {'ok':True}

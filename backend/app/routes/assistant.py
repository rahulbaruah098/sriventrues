"""Public website assistant: no external AI services or API keys.

Answers only from reviewed multilingual facts and currently published content.
"""
import re
import time
import unicodedata
from collections import defaultdict, deque
from difflib import SequenceMatcher
from threading import Lock

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest, TooManyRequests

from ..core import CONTENT, KINDS, db
from .editorial import published_page

assistant = Blueprint('assistant', __name__)

# Lightweight best-effort rate control. For multi-worker production use a shared limiter.
_requests = defaultdict(deque)
_lock = Lock()

LANGS = ('en', 'as', 'hi')
GREETINGS = {
    'en': 'Hello! I can help you explore SRI Ventures & Consulting, its services, products and published work.',
    'as': 'নমস্কাৰ! মই SRI Ventures & Consulting-ৰ সেৱা, সামগ্ৰী আৰু প্ৰকাশিত কামৰ বিষয়ে তথ্য বিচাৰি পোৱাত সহায় কৰিব পাৰোঁ।',
    'hi': 'नमस्कार! मैं SRI Ventures & Consulting की सेवाओं, उत्पादों और प्रकाशित कार्यों की जानकारी खोजने में आपकी सहायता कर सकता हूँ।',
}
FALLBACK = {
    'en': "I couldn't find a reliable answer in SRI's published website information. Please explore the suggested pages or contact the SRI team for details.",
    'as': 'SRI-ৰ প্ৰকাশিত ৱেবছাইটত এই প্ৰশ্নটোৰ নিৰ্ভৰযোগ্য উত্তৰ পোৱা নগ’ল। অধিক তথ্যৰ বাবে সংশ্লিষ্ট পৃষ্ঠা চাওক বা SRI দলৰ সৈতে যোগাযোগ কৰক।',
    'hi': 'SRI की प्रकाशित वेबसाइट जानकारी में इस प्रश्न का विश्वसनीय उत्तर नहीं मिला। कृपया संबंधित पेज देखें या अधिक जानकारी के लिए SRI टीम से संपर्क करें।',
}
LANG_TEXT = {
    'en': {'more': 'You can read more on the website:', 'intro': 'Here is what the website says about', 'latest': 'The website currently lists these published items:', 'contact': 'You can contact the SRI team using the enquiry form.'},
    'as': {'more': 'ৱেবছাইটত অধিক পঢ়ক:', 'intro': 'ৱেবছাইটত এই বিষয়ে প্ৰকাশিত তথ্য:', 'latest': 'ৱেবছাইটত প্ৰকাশিত তথ্যসমূহ:', 'contact': 'যোগাযোগ ফৰ্মৰ জৰিয়তে SRI দলৰ সৈতে যোগাযোগ কৰিব পাৰে।'},
    'hi': {'more': 'वेबसाइट पर और पढ़ें:', 'intro': 'वेबसाइट पर प्रकाशित जानकारी:', 'latest': 'वेबसाइट पर प्रकाशित सामग्री:', 'contact': 'आप पूछताछ फॉर्म के माध्यम से SRI टीम से संपर्क कर सकते हैं।'},
}

TOPICS = [
    dict(id='about', title='About SRI', url='/about/', aliases=['what is sri', 'about sri', 'company', 'mission', 'sri ventures and consulting', 'sri কি', 'কোম্পানী', 'সংস্থা', 'एसआरआई क्या है', 'कंपनी', 'संस्था', 'मिशन'],
         answers={
            'en': 'SRI Ventures & Consulting Pvt. Ltd. works across two complementary verticals: enterprise ventures and professional consulting. It connects products and markets while strengthening rural enterprises and producer institutions.',
            'as': 'SRI Ventures & Consulting Pvt. Ltd.-এ দুটা পৰিপূৰক ক্ষেত্ৰত কাম কৰে—উদ্যোগভিত্তিক ব্যৱসায় আৰু পেছাদাৰী পৰামৰ্শ সেৱা। সংস্থাটোৱে সামগ্ৰী আৰু বজাৰ সংযোগ কৰাৰ লগতে গ্ৰাম্য উদ্যোগ আৰু উৎপাদক প্ৰতিষ্ঠানসমূহ শক্তিশালী কৰাত গুৰুত্ব দিয়ে।',
            'hi': 'SRI Ventures & Consulting Pvt. Ltd. दो प्रमुख क्षेत्रों में काम करती है—व्यावसायिक उद्यम और पेशेवर परामर्श। यह उत्पादों को बाजारों से जोड़ने और ग्रामीण उद्यमों तथा उत्पादक संस्थाओं को मजबूत करने पर काम करती है।',
         }),
    dict(id='ventures', title='SRI Ventures', url='/ventures/', aliases=['ventures', 'farm inputs', 'farm outputs', 'handloom', 'supplies', 'agricultural products', 'ভেঞ্চাৰ', 'কৃষি সামগ্ৰী', 'হস্ততাঁত', 'वेंचर्स', 'कृषि उत्पाद', 'हथकरघा'],
         answers={
            'en': 'SRI Ventures covers farm inputs, farm outputs and handloom-related products. Explore its product catalogue for currently published offerings and details.',
            'as': 'SRI Ventures-ৰ কামৰ ভিতৰত কৃষি উপকৰণ, কৃষিজ উৎপাদন আৰু হস্ততাঁত-সম্পৰ্কীয় সামগ্ৰী অন্তৰ্ভুক্ত। বৰ্তমান প্ৰকাশিত সামগ্ৰীৰ তথ্যৰ বাবে প্ৰডাক্ট কেটেলগ চাওক।',
            'hi': 'SRI Ventures कृषि इनपुट, कृषि उत्पाद और हथकरघा से जुड़े उत्पादों पर काम करती है। वर्तमान प्रकाशित उत्पादों के लिए प्रोडक्ट कैटलॉग देखें।',
         }),
    dict(id='consulting', title='SRI Consulting', url='/consulting/', aliases=['consulting', 'advisory', 'business strategy', 'engagement models', 'feasibility', 'value chain', 'পৰামৰ্শ', 'ব্যৱসায়িক পৰামৰ্শ', 'কৌশল', 'सलाह', 'परामर्श', 'रणनीति', 'व्यवसाय प्रबंधन'],
         answers={
            'en': 'SRI Consulting offers advisory support across business strategy and management, livestock and agribusiness, value-chain development and institutional strengthening. Read the relevant service pages for details of its approach and engagement models.',
            'as': 'SRI Consulting-এ ব্যৱসায়িক কৌশল আৰু ব্যৱস্থাপনা, পশুপালন আৰু কৃষিভিত্তিক ব্যৱসায়, মূল্য শৃংখল উন্নয়ন আৰু প্ৰতিষ্ঠান শক্তিশালীকৰণৰ ক্ষেত্ৰত পৰামৰ্শ আগবঢ়ায়। বিস্তৃত তথ্যৰ বাবে সেৱাৰ পৃষ্ঠাসমূহ চাওক।',
            'hi': 'SRI Consulting व्यवसाय रणनीति और प्रबंधन, पशुपालन व कृषि व्यवसाय, मूल्य श्रृंखला विकास और संस्थागत सुदृढ़ीकरण में परामर्श सहायता प्रदान करती है। अधिक जानकारी के लिए संबंधित सेवा पेज देखें।',
         }),
    dict(id='industries', title='Industries We Serve', url='/industries/', aliases=['industries', 'sectors', 'poultry', 'piggery', 'goatery', 'dairy', 'fisheries', 'agriculture', 'উদ্যোগ', 'মুৰ্গী', 'গাহৰি', 'ছাগলী', 'দুগ্ধ', 'মাছ', 'উद्योग', 'मुर्गी', 'सूअर', 'बकरी', 'डेयरी', 'मत्स्य'],
         answers={
            'en': 'SRI serves sectors including poultry, piggery, goatery, dairy, agriculture and agribusiness, fisheries, food processing, handloom and producer institutions. Visit Industries for the full current list.',
            'as': 'SRI-এ কুকুৰা পালন, গাহৰি পালন, ছাগলী পালন, দুগ্ধ উৎপাদন, কৃষি আৰু কৃষিভিত্তিক ব্যৱসায়, মৎস্য, খাদ্য প্ৰক্ৰিয়াকৰণ, হস্ততাঁত আৰু উৎপাদক প্ৰতিষ্ঠানৰ সৈতে কাম কৰে। সম্পূৰ্ণ তালিকা Industries পৃষ্ঠাত আছে।',
            'hi': 'SRI मुर्गीपालन, सूअरपालन, बकरीपालन, डेयरी, कृषि और कृषि व्यवसाय, मत्स्य, खाद्य प्रसंस्करण, हथकरघा तथा उत्पादक संस्थाओं जैसे क्षेत्रों में काम करती है। पूरी सूची Industries पेज पर देखें।',
         }),
    dict(id='founder', title='Know the Founder', url='/know-the-founder/', aliases=['founder', 'who founded', 'leadership', 'founder name', 'প্ৰতিষ্ঠাপক', 'প্ৰতিষ্ঠাতা', 'संस्थापक', 'फाउंडर', 'नेतृत्व'],
         answers=None),
    dict(id='approach', title='Our Approach', url='/our-approach/', aliases=['approach', 'methodology', 'how you work', 'work process', 'পদ্ধতি', 'কৰ্মপদ্ধতি', 'दृष्टिकोण', 'कार्य पद्धति', 'कैसे काम'], answers=None),
    dict(id='work', title='Our Work', url='/our-work/', aliases=['our work', 'projects', 'case studies', 'impact', 'project', 'কাম', 'প্ৰকল্প', 'অভিজ্ঞতা', 'परियोजनाएं', 'कार्य', 'केस स्टडी'], answers=None),
    dict(id='products', title='Product Catalogue', url='/ventures/products/', aliases=['product', 'products', 'catalogue', 'price', 'available items', 'সামগ্ৰী', 'দাম', 'তালিকা', 'उत्पाद', 'कैटलॉग', 'कीमत'], answers=None),
    dict(id='insights', title='Insights & Articles', url='/insights/', aliases=['insights', 'articles', 'news', 'blogs', 'research', 'প্ৰবন্ধ', 'গৱেষণা', 'বাতৰি', 'लेख', 'समाचार', 'शोध'], answers=None),
    dict(id='contact', title='Contact SRI', url='/contact/', aliases=['contact', 'enquiry', 'email', 'phone', 'reach out', 'partnership', 'যোগাযোগ', 'ফোন', 'সহযোগিতা', 'संपर्क', 'फोन', 'ईमेल', 'साझेदारी'],
         answers={'en': LANG_TEXT['en']['contact'], 'as': LANG_TEXT['as']['contact'], 'hi': LANG_TEXT['hi']['contact']}),
]

KIND_ROUTE = {'products': '/ventures/products/', 'articles': '/insights/', 'case-studies': '/our-work/'}


def normalise(text):
    return re.sub(r'[^\w\s]', ' ', unicodedata.normalize('NFKC', str(text)).casefold()).strip()


def score(query, phrase):
    a, b = normalise(query), normalise(phrase)
    if not a or not b:
        return 0.0
    if a == b:
        return 12.0
    if b in a and len(b) > 3:
        return 5.0 + min(len(b) / 60, 1)
    aa, bb = set(a.split()), set(b.split())
    overlap = len(aa & bb)
    ratio = SequenceMatcher(None, a, b).ratio()
    return (overlap / max(1, len(bb))) * 2.8 + ratio * 1.5 if overlap else ratio * 0.9


def candidates():
    entries = []
    for group, base in (('ventures', '/ventures/'), ('consulting', '/consulting/'), ('industries', '/industries/')):
        for row in CONTENT[group]:
            entries.append({'title': row['title'], 'text': row.get('description', '') or row.get('headline', ''), 'url': base + row['slug'] + '/'})
    for kind, route in KIND_ROUTE.items():
        coll = db()[KINDS[kind]]
        for row in coll.find({'status': 'published'}, {'slug': 1, 'title': 1, 'excerpt': 1}).limit(120):
            if row.get('slug'):
                entries.append({'title': row.get('title', ''), 'text': row.get('excerpt', ''), 'url': route + row['slug'] + '/'})
    return entries


def answer_topic(topic, lang):
    if topic['answers']:
        return topic['answers'][lang]
    if topic['id'] == 'founder':
        page = published_page('founder')
        details = ' '.join(x for x in (page.get('name'), page.get('role')) if x)
        if not details:
            return FALLBACK[lang]
        return (LANG_TEXT[lang]['intro'] + ': ' + details + '. ' + (page.get('bio') or '')[:650]).strip()
    if topic['id'] == 'approach':
        page = published_page('approach')
        stages = ', '.join(x.get('name', '') for x in page.get('stages', []) if x.get('enabled', True))
        return (LANG_TEXT[lang]['intro'] + ' ' + (page.get('heading') or '') + '. ' + (page.get('intro') or '')[:450] + (' ' + stages if stages else '')).strip()
    if topic['id'] in ('work', 'products', 'insights'):
        kind = {'work': 'case-studies', 'products': 'products', 'insights': 'articles'}[topic['id']]
        rows = list(db()[KINDS[kind]].find({'status': 'published'}, {'title': 1, 'slug': 1}).limit(4))
        if not rows:
            return FALLBACK[lang]
        return LANG_TEXT[lang]['latest'] + ' ' + '; '.join(x.get('title', '') for x in rows)
    return FALLBACK[lang]


def limiting():
    # Rate limit is intentionally conservative and local to each Flask process.
    ip = request.remote_addr or 'unknown'
    now_sec = time.monotonic()
    with _lock:
        if len(_requests) > 5000:
            _requests.clear()
        history = _requests[ip]
        while history and now_sec - history[0] > 60:
            history.popleft()
        if len(history) >= 35:
            raise TooManyRequests('Too many questions. Please try again shortly.')
        history.append(now_sec)


@assistant.post('/api/public/assistant/ask')
def ask():
    limiting()
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise BadRequest('Please provide a question.')
    question, lang = body.get('question'), body.get('language', 'en')
    if lang not in LANGS:
        raise BadRequest('Unsupported language.')
    if not isinstance(question, str) or not 1 <= len(question.strip()) <= 500:
        raise BadRequest('Please write a question of up to 500 characters.')
    text = question.strip()
    if normalise(text) in ('hi', 'hello', 'hey', 'namaste', 'নমস্কাৰ', 'नमस्ते'):
        return jsonify(answer=GREETINGS[lang], sources=[], suggestions=['About SRI', 'SRI Ventures', 'SRI Consulting'], confidence='high')
    scores = sorted(((max(score(text, alias) for alias in topic['aliases']), topic) for topic in TOPICS), key=lambda x: -x[0])
    best_score, topic = scores[0]
    entries = candidates()
    matches = sorted(((max(score(text, x['title']), score(text, x['text'][:160]) * 0.7), x) for x in entries), key=lambda x: -x[0])
    top_entry_score, top_entry = matches[0] if matches else (0, None)

    if top_entry and top_entry_score >= 3.2 and top_entry_score > best_score + 0.6:
        # Published summaries remain in their authoring language. Do not imply a full translation.
        prefix = LANG_TEXT[lang]['intro']
        answer = f"{prefix} {top_entry['title']}: {top_entry['text'][:650]}"
        sources = [{'title': top_entry['title'], 'url': top_entry['url']}]
        confidence = 'medium'
    elif best_score >= 1.9:
        answer = answer_topic(topic, lang)
        sources = [{'title': topic['title'], 'url': topic['url']}]
        confidence = 'high' if best_score >= 3.2 else 'medium'
    else:
        answer = FALLBACK[lang]
        sources = [{'title': 'About SRI', 'url': '/about/'}, {'title': 'Contact SRI', 'url': '/contact/'}]
        confidence = 'none'
    return jsonify(answer=answer, sources=sources, confidence=confidence,
                   suggestions=[t['title'] for _, t in scores[1:4]])

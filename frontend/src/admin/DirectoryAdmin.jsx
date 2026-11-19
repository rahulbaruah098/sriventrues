import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData, dateLabel } from '../lib/api';
import { Resource } from '../components/ui';
import { AdminTitle, Field, Upload, Feedback, useSave } from './controls';
const RichEditor = lazy(() => import('./RichEditor'));
const names = {team:'Meet the Team', consultants:'Know Our Consultants', blogs:'Blogs'};
const empty = {name:'',title:'',slug:'',designation:'',department:'',expertise:'',qualification:'',experience:'',author:'',category:'',summary:'',image:'',image_alt:'',body:'',status:'draft',order:0,seo_title:'',seo_description:''};
const slugify = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
export function DirectoryAdminList({kind}) {
  const records = useData('admin/directory/'+kind+'?limit=100');
  return <><AdminTitle title={names[kind]} description="Create and publish entries for the public website."><Link className="button" to={'/admin/'+kind+'/new'}>Add new</Link></AdminTitle>
    <Resource value={records}>{d => d.items.length ? <div className="table-wrap"><table><thead><tr><th>Name / title</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>{d.items.map(r=><tr key={r.id}><td>{r.title||r.name}</td><td>{r.status}</td><td>{dateLabel(r.updated_at)}</td><td><Link to={'/admin/'+kind+'/'+r.id}>Edit</Link></td></tr>)}</tbody></table></div> : <div className="panel"><p>No entries yet. Create the first record to get started.</p></div>}</Resource>
  </>;
}
export function DirectoryAdminEditor({kind}) {
  const {id} = useParams(), nav = useNavigate();
  const saved = useData(id==='new' ? null : 'admin/directory/'+kind+'/'+id);
  const [doc,setDoc] = useState({...empty}), [slugManual,setSlugManual] = useState(false);
  const state=useSave();
  useEffect(()=> {if(saved.data) {setDoc({...empty,...saved.data});setSlugManual(true);}},[saved.data]);
  const set=(key,value)=>setDoc(d=>({...d,[key]:value}));
  const text=(key,label,opts={})=><Field label={label} value={doc[key]} onChange={v=>{set(key,v);if((key==='name'||key==='title')&&!slugManual)setDoc(d=>({...d,[key]:v,slug:slugify(v)}));}} {...opts}/>;
  const save=()=>state.run(async()=>{const newRecord=id==='new';const result=await api('admin/directory/'+kind+(newRecord?'':'/'+id),{method:newRecord?'POST':'PUT',data:doc});setDoc({...empty,...result});if(newRecord)nav('/admin/'+kind+'/'+result.id,{replace:true});},'Saved successfully.');
  const remove=()=>{if(!window.confirm('Permanently delete this record?'))return;state.run(async()=>{await api('admin/directory/'+kind+'/'+id,{method:'DELETE',data:{version:doc.version}});nav('/admin/'+kind);},'Deleted.');};
  return <><AdminTitle title={(id==='new'?'New ':'Edit ')+names[kind]}><Link to={'/admin/'+kind}>Back to list</Link></AdminTitle>
   {id!=='new'&&!saved.data ? <Resource value={saved}>{()=>null}</Resource> : <form onSubmit={e=>{e.preventDefault();save();}}>
    <section className="panel field-grid">{kind==='blogs'?text('title','Blog title',{required:true}):text('name','Full name',{required:true})}
      {text('slug','URL slug',{required:true,pattern:'[a-z0-9]+(-[a-z0-9]+)*',onFocus:()=>setSlugManual(true)})}
      {kind==='blogs'?<>{text('category','Category')}{text('author','Author')}</>:<>{text('designation','Designation / role')}{kind==='team'?text('department','Department / group'):text('expertise','Areas of expertise')}{text('qualification','Qualifications')}{kind==='consultants'&&text('experience','Experience')}</>}
      <Field label="Display order" type="number" min="0" max="99999" value={doc.order} onChange={v=>set('order',Number(v)||0)}/>
      <Field label="Publication status" options={['draft','published']} value={doc.status} onChange={v=>set('status',v)}/>
      {text('summary',kind==='blogs'?'Summary / excerpt':'Short biography',{type:'textarea',wide:true,maxLength:1200})}
    </section>
    <section className="panel field-grid"><Upload label={kind==='blogs'?'Cover image':'Portrait'} value={doc.image} onChange={v=>set('image',v)}/>{text('image_alt','Image description / alt text',{maxLength:350})}</section>
    <section className="panel"><h2>{kind==='blogs'?'Blog article':'Full biography'}</h2><Suspense fallback={<p>Loading rich editor…</p>}><RichEditor key={doc.id||'new'} value={doc.body} onChange={v=>set('body',v)}/></Suspense></section>
    <section className="panel field-grid">{text('seo_title','SEO title')}{text('seo_description','SEO description',{type:'textarea',wide:true})}</section>
    <Feedback {...state}/><div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}><button disabled={state.busy} className="button" type="submit">{state.busy?'Saving…':'Save '+(doc.status==='published'?'& publish':'draft')}</button>{id!=='new'&&<button disabled={state.busy} className="text-button" type="button" onClick={remove}>Delete record</button>}</div>
   </form>}
  </>;
}

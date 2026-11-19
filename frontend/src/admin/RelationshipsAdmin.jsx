import React, {useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {api,useData,dateLabel} from '../lib/api';
import {Resource} from '../components/ui';
import {AdminTitle,Field,Upload,Feedback,useSave} from './controls';

const labels={clients:'Our Trusted Clients',partners:'Our Partners',testimonials:'Testimonials'};
const blank={name:'',image:'',image_alt:'',website:'',designation:'',organisation:'',quote:'',order:0,status:'draft'};
export function RelationshipsList({kind}) {
  const records=useData('admin/relationships/'+kind+'?limit=100');
  return <><AdminTitle title={labels[kind]} description="Manage what visitors see on the homepage. Only published entries appear.">
    <Link className="button" to={'/admin/'+kind+'/new'}>Add new</Link>
  </AdminTitle>
  <Resource value={records}>{data=>data.items.length?<div className="table-wrap"><table><thead><tr><th>Name</th><th>Visibility</th><th>Order</th><th>Updated</th><th></th></tr></thead><tbody>{data.items.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.status}</td><td>{x.order}</td><td>{dateLabel(x.updated_at)}</td><td><Link to={'/admin/'+kind+'/'+x.id}>Edit</Link></td></tr>)}</tbody></table></div>:<div className="panel"><p>No entries have been created. This homepage section remains hidden until you publish one.</p></div>}</Resource>
  </>;
}
export function RelationshipsEditor({kind}) {
 const {id}=useParams(),nav=useNavigate();
 const existing=useData(id==='new'?null:'admin/relationships/'+kind+'/'+id);
 const [doc,setDoc]=useState({...blank}); const state=useSave();
 useEffect(()=>{if(existing.data)setDoc({...blank,...existing.data});},[existing.data]);
 const set=(key,v)=>setDoc(d=>({...d,[key]:v}));
 const field=(key,label,extra={})=><Field label={label} value={doc[key]} onChange={v=>set(key,v)} {...extra}/>;
 const save=()=>state.run(async()=>{
   const create=id==='new';
   const saved=await api('admin/relationships/'+kind+(create?'':'/'+id),{method:create?'POST':'PUT',data:doc});
   setDoc({...blank,...saved});
   if(create)nav('/admin/'+kind+'/'+saved.id,{replace:true});
 },'Entry saved successfully.');
 const remove=()=>{if(!window.confirm('Delete this entry permanently?'))return;state.run(async()=>{await api('admin/relationships/'+kind+'/'+id,{method:'DELETE',data:{version:doc.version}});nav('/admin/'+kind);},'Deleted.');};
 return <><AdminTitle title={(id==='new'?'Add ':'Edit ')+labels[kind]}><Link to={'/admin/'+kind}>Back to list</Link></AdminTitle>
 {id!=='new'&&!existing.data?<Resource value={existing}>{()=>null}</Resource>:<form onSubmit={e=>{e.preventDefault();save();}}>
   <section className="panel field-grid">
     {field('name',kind==='testimonials'?'Person name':'Company / organisation name',{required:true,maxLength:180})}
     {kind==='testimonials'?<>{field('designation','Designation / role')}{field('organisation','Organisation')}{field('quote','Testimonial / feedback',{type:'textarea',wide:true,required:doc.status==='published',maxLength:2500})}</>:field('website','Website (optional)',{type:'url',placeholder:'https://example.com'})}
     <Field label="Display order" type="number" min="0" max="99999" value={doc.order} onChange={v=>set('order',Number(v)||0)}/>
     <Field label="Publication status" options={['draft','published']} value={doc.status} onChange={v=>set('status',v)}/>
   </section>
   <section className="panel field-grid">
     <Upload label={kind==='testimonials'?'Person photograph (optional)':'Company logo (optional)'} value={doc.image} onChange={v=>set('image',v)}/>
     {field('image_alt','Image description (optional)',{maxLength:220})}
     {doc.image&&<button type="button" className="text-button" onClick={()=>set('image','')}>Remove image</button>}
   </section>
   <Feedback {...state}/><div style={{display:'flex',flexWrap:'wrap',gap:'1rem'}}><button className="button" disabled={state.busy} type="submit">{state.busy?'Saving…':'Save '+(doc.status==='published'?'& publish':'draft')}</button>{id!=='new'&&<button type="button" className="text-button" disabled={state.busy} onClick={remove}>Delete</button>}</div>
 </form>}
 </>;
}

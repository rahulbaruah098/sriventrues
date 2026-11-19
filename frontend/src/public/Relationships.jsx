import React from 'react';
import {useData} from '../lib/api';
import '../styles/relationships.css';

const blocks=[
  {kind:'clients',heading:'Our trusted clients.',eyebrow:'01 / Relationships',direction:'left'},
  {kind:'partners',heading:'Our partners.',eyebrow:'02 / Collaborations',direction:'right'},
  {kind:'testimonials',heading:'In their words.',eyebrow:'03 / Testimonials',direction:'left'},
];
function Strip({config}) {
  const response=useData('public/relationships/'+config.kind+'?limit=100');
  const items=response.data?.items||[];
  if (!items.length) return null;
  const moving=items.length>1;
  const isQuote=config.kind==='testimonials';
  // Each half of the loop must be wider than a desktop viewport even for two records.
  const repeatCount=moving?Math.max(1,Math.ceil(10/items.length)):1;
  const ribbon=Array.from({length:repeatCount},()=>items).flat();
  const render=(item,key,duplicate=false)=><div className={'sri-rel-item '+(isQuote?'sri-rel-quote':'sri-rel-brand')} key={key} aria-hidden={duplicate||undefined}>
    {isQuote?<>
      <p className="sri-rel-quotation">“{item.quote}”</p>
      <div className="sri-rel-attribution">
        {item.image&&<img src={item.image} alt={duplicate?'':(item.image_alt||item.name)} loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>}
        <div><strong>{item.name}</strong>{(item.designation||item.organisation)&&<span>{[item.designation,item.organisation].filter(Boolean).join(' · ')}</span>}</div>
      </div>
    </>:item.website?<a href={item.website} target="_blank" rel="noopener noreferrer" tabIndex={duplicate?-1:undefined} aria-label={'Visit '+item.name+' website'}>
       {item.image&&<img src={item.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>}<strong>{item.name}</strong>
      </a>:<div className="sri-rel-brand-static">{item.image&&<img src={item.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>}<strong>{item.name}</strong></div>}
  </div>;
  return <section className={'sri-rel-section sri-rel-'+config.kind} aria-label={config.heading}>
    <div className="wrap sri-rel-heading"><span>{config.eyebrow}</span><h2>{config.heading}</h2></div>
    <div className={'sri-rel-viewport '+(!moving?'sri-rel-single':'')}>
      <div className={'sri-rel-track '+(moving?'sri-rel-moving sri-rel-to-'+config.direction:'')} style={moving?{'--sri-rel-duration':Math.max(25,items.length*(isQuote?11:7))+'s'}:undefined}>
        <div className="sri-rel-set">{ribbon.map((item,i)=>render(item,'a-'+i,i>=items.length))}</div>
        {moving&&<div className="sri-rel-set" aria-hidden="true">{ribbon.map((item,i)=>render(item,'b-'+i,true))}</div>}
      </div>
    </div>
  </section>;
}
export default function Relationships(){return <div className="sri-relationships">{blocks.map(config=><Strip key={config.kind} config={config}/>)}</div>;}

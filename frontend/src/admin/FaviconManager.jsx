import React, {useEffect, useRef, useState} from 'react';
import {api} from '../lib/api';
import {AdminTitle} from './controls';
import '../styles/favicon-manager.css';

const SHAPES = [{id:'square',name:'Square'},{id:'rounded',name:'Rounded square'},{id:'circle',name:'Circle'}];
const DEFAULT = '/favicon.png';

export function FaviconManager() {
  const [sourceData,setSourceData]=useState(null);
  const [image,setImage]=useState(null);
  const [shape,setShape]=useState('square');
  const [zoom,setZoom]=useState(1);
  const [fitMode,setFitMode]=useState('contain');
  const [angle,setAngle]=useState(0);
  const [offset,setOffset]=useState({x:0,y:0});
  const [revision,setRevision]=useState(0);
  const [custom,setCustom]=useState(false);
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const canvas=useRef(null);
  const drag=useRef(null);

  const setSource=(data) => {
    if(!data){setSourceData(null);setImage(null);return;}
    const picture = new Image();
    picture.onload=()=>{setImage(picture);setSourceData(data);setZoom(1);setFitMode('contain');setAngle(0);setOffset({x:0,y:0});};
    picture.onerror=()=>setError('Could not load this image.');
    picture.src=data;
  };

  useEffect(()=>{
    let active=true;
    api('admin/favicon').then(data=>{
      if(!active)return;
      setRevision(data.revision||0);
      setCustom(!!data.custom);
      setShape(data.shape||'square');
      if(data.source_data)setSource(data.source_data);
    }).catch(e=>active&&setError(e.message));
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    const c=canvas.current;
    if(!c||!image)return;
    const ctx=c.getContext('2d');
    if(!ctx)return;
    const S=512;
    ctx.clearRect(0,0,S,S);
    ctx.save();
    // Fit uses the whole logo with breathing room; Fill intentionally crops edges.
    ctx.translate(S/2+offset.x,S/2+offset.y);
    ctx.rotate(angle*Math.PI/180);
    const factor=(fitMode==='contain' ? Math.min((S*.88)/image.width,(S*.88)/image.height) : Math.max(S/image.width,S/image.height))*zoom;
    ctx.drawImage(image,-image.width*factor/2,-image.height*factor/2,image.width*factor,image.height*factor);
    ctx.restore();
    if(shape!=='square'){
      ctx.save();
      ctx.globalCompositeOperation='destination-in';
      ctx.beginPath();
      if(shape==='circle')ctx.arc(S/2,S/2,S/2,0,Math.PI*2);
      else if(ctx.roundRect)ctx.roundRect(0,0,S,S,96);
      else {ctx.moveTo(96,0);ctx.lineTo(416,0);ctx.quadraticCurveTo(512,0,512,96);ctx.lineTo(512,416);ctx.quadraticCurveTo(512,512,416,512);ctx.lineTo(96,512);ctx.quadraticCurveTo(0,512,0,416);ctx.lineTo(0,96);ctx.quadraticCurveTo(0,0,96,0);}
      ctx.closePath();ctx.fill();ctx.restore();
    }
    setPreview(c.toDataURL('image/png'));
  },[image,offset,zoom,angle,shape,fitMode]);

  async function chooseFile(event){
    const file=event.target.files?.[0];
    if(!file)return;
    event.target.value='';
    setError('');setMessage('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
      setError('Upload a PNG, JPG or WebP image.');return;
    }
    if(file.size>3_000_000){setError('Upload an image smaller than 3 MB.');return;}
    const url=URL.createObjectURL(file);
    const picture=new Image();
    picture.onload=()=>{
      try{
        if(picture.width*picture.height>20_000_000)throw new Error('Image dimensions are too large.');
        const natural=document.createElement('canvas');
        const scale=Math.min(1,1000/Math.max(picture.width,picture.height));
        natural.width=Math.max(1,Math.round(picture.width*scale));
        natural.height=Math.max(1,Math.round(picture.height*scale));
        natural.getContext('2d').drawImage(picture,0,0,natural.width,natural.height);
        setSource(natural.toDataURL('image/png'));
      }catch(e){setError(e.message||'Could not process image.');}
      URL.revokeObjectURL(url);
    };
    picture.onerror=()=>{URL.revokeObjectURL(url);setError('Image could not be opened.');};
    picture.src=url;
  }
  function start(e){if(!image)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,prev:offset};}
  function move(e){if(!drag.current)return;const k=512/e.currentTarget.getBoundingClientRect().width;setOffset({x:drag.current.prev.x+(e.clientX-drag.current.x)*k,y:drag.current.prev.y+(e.clientY-drag.current.y)*k});}
  function stop(){drag.current=null;}
  function resetEdits(){setZoom(1);setFitMode('contain');setAngle(0);setOffset({x:0,y:0});}

  async function save(){
    if(!sourceData||!image||!canvas.current)return setError('Select an image before publishing.');
    setBusy(true);setError('');setMessage('');
    try{
      const result=await api('admin/favicon/publish',{method:'POST',data:{source_data:sourceData,cropped_data:canvas.current.toDataURL('image/png'),shape}});
      setRevision(result.revision||0);setCustom(true);
      window.dispatchEvent(new Event('sri:favicon-updated'));
      setMessage('Favicon published successfully. The browser tab will update automatically.');
    }catch(e){setError(e.message||'Could not save favicon.');}
    finally{setBusy(false);}
  }
  async function restore(){
    if(!window.confirm('Restore the default SRI favicon?'))return;
    setBusy(true);setError('');setMessage('');
    try{
      await api('admin/favicon/reset',{method:'POST'});
      setSource(null);setCustom(false);setRevision(0);setShape('square');
      window.dispatchEvent(new Event('sri:favicon-updated'));
      setMessage('Default SRI favicon restored.');
    }catch(e){setError(e.message||'Could not restore default.');}
    finally{setBusy(false);}
  }
  const currentURL=custom?`/api/public/favicon/512.png?v=${revision}`:DEFAULT;
  return <div className="sri-favicon-admin">
    <AdminTitle title="Website Favicon" description="Manage the small SRI logo shown on browser tabs and saved bookmarks." />
    <div className="sri-favicon-grid">
      <section className="sri-favicon-panel">
        <h2>1 / Upload and crop</h2>
        <p>Choose the SRI symbol or another approved brand image. Drag to position it, then refine its crop.</p>
        <label className="sri-favicon-upload">Choose image <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile}/></label>
        {image?<>
          <div className="sri-favicon-editor"><canvas ref={canvas} width="512" height="512" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label="Favicon cropping area; drag image to reposition" /></div>
          <div className="sri-favicon-shapes" role="group" aria-label="Crop shape">{SHAPES.map(x=><button key={x.id} type="button" className={shape===x.id?'is-active':''} onClick={()=>setShape(x.id)}>{x.name}</button>)}</div>
          <div className="sri-favicon-fit-mode" role="group" aria-label="Image sizing mode"><span>Image fit</span><button type="button" className={fitMode==='contain'?'is-active':''} onClick={()=>{setFitMode('contain');setZoom(1);setOffset({x:0,y:0})}}>Fit whole logo</button><button type="button" className={fitMode==='cover'?'is-active':''} onClick={()=>{setFitMode('cover');setZoom(1);setOffset({x:0,y:0})}}>Fill crop area</button></div>
          <p className="sri-favicon-fit-hint">Fit whole logo keeps the entire artwork visible. Fill crop area is useful when you want only the SRI symbol. Drag to position; use Zoom for finer adjustments.</p>
          <label className="sri-favicon-range">Zoom <span>{Math.round(zoom*100)}%</span><input type="range" min="0.5" max="5" step="0.01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
          <label className="sri-favicon-range">Rotate <span>{angle}°</span><input type="range" min="-180" max="180" step="1" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
          <button className="sri-favicon-reset" type="button" onClick={resetEdits}>Reset crop position</button>
        </>:<div className="sri-favicon-placeholder">Upload a logo to open the crop editor</div>}
      </section>
      <section className="sri-favicon-panel">
        <h2>2 / Live browser previews</h2>
        <p>Preview how the cropped mark looks at the sizes used in browser tabs and app shortcuts.</p>
        <div className="sri-favicon-sample"><span className="sri-favicon-mini">{image?<img src={preview||currentURL} alt="Favicon tab preview"/>:<img src={currentURL} alt="Current SRI favicon"/>}</span><strong>SRI Ventures & Consulting</strong><span className="sri-favicon-tab-close">×</span></div>
        <div className="sri-favicon-preview-row"><div><span>16 × 16</span><img alt="16 pixel preview" src={image?(preview||currentURL):currentURL} width="16" height="16" /></div><div><span>32 × 32</span><img alt="32 pixel preview" src={image?(preview||currentURL):currentURL} width="32" height="32" /></div><div><span>64 × 64</span><img alt="64 pixel preview" src={image?(preview||currentURL):currentURL} width="64" height="64" /></div></div>
        <div className="sri-favicon-preview-note">Tip: a favicon is usually clearer with only the SRI symbol. The small company name and tagline will not be legible at 16 × 16 pixels.</div>
        <div className="sri-favicon-actions"><button type="button" className="button" onClick={save} disabled={busy||!image}>{busy?'Publishing…':'Save & publish favicon'}</button><button type="button" onClick={restore} disabled={busy||!custom}>Restore SRI default</button></div>
        {error&&<p role="alert" className="sri-favicon-error">{error}</p>}{message&&<p role="status" className="sri-favicon-success">{message}</p>}
      </section>
    </div>
  </div>;
}

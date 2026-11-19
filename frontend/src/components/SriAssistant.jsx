import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Send, X, BookOpen, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import '../styles/sri-assistant.css';

const I18N = {
  en: { title: 'SRI Assistant', desc: 'Your guide to SRI Ventures & Consulting', welcome: 'Ask me about our ventures, consulting services, products, founder and published work.', ask: 'You can also ask', more: 'Need more details?', contact: 'Enquire with SRI', related: 'Explore related sections', placeholder: 'Ask a question about SRI…', busy: 'Searching website knowledge…', open: 'Chat with SRI Assistant', close: 'Close assistant', prompts: ['What does SRI Ventures do?', 'What consulting services do you offer?', 'Who is the founder?', 'How can I partner with SRI?'] },
  as: { title: 'SRI সহায়ক', desc: 'SRI Ventures & Consulting-ৰ তথ্য সহায়ক', welcome: 'SRI-ৰ উদ্যোগ, পৰামৰ্শ সেৱা, সামগ্ৰী, প্ৰতিষ্ঠাপক আৰু প্ৰকাশিত কামৰ বিষয়ে সুধক।', ask: 'আৰু সুধিব পাৰে', more: 'অধিক তথ্য লাগে নেকি?', contact: 'SRI-ৰ সৈতে যোগাযোগ', related: 'সংশ্লিষ্ট পৃষ্ঠা চাওক', placeholder: 'SRI-ৰ বিষয়ে প্ৰশ্ন লিখক…', busy: 'ৱেবছাইটত তথ্য বিচাৰি থকা হৈছে…', open: 'SRI সহায়কৰ সৈতে কথা পাতক', close: 'সহায়ক বন্ধ কৰক', prompts: ['SRI Ventures-এ কি কাম কৰে?', 'পৰামৰ্শ সেৱা কি কি?', 'প্ৰতিষ্ঠাপক কোন?', 'যোগাযোগ কেনেকৈ কৰিব?'] },
  hi: { title: 'SRI सहायक', desc: 'SRI Ventures & Consulting का जानकारी सहायक', welcome: 'SRI के उद्यम, परामर्श सेवाओं, उत्पादों, संस्थापक और प्रकाशित कार्य के बारे में पूछें।', ask: 'आप यह भी पूछ सकते हैं', more: 'अधिक जानकारी चाहिए?', contact: 'SRI से संपर्क करें', related: 'संबंधित पेज देखें', placeholder: 'SRI के बारे में प्रश्न लिखें…', busy: 'वेबसाइट पर जानकारी खोजी जा रही है…', open: 'SRI सहायक से पूछें', close: 'सहायक बंद करें', prompts: ['SRI Ventures क्या करती है?', 'परामर्श सेवाएँ क्या हैं?', 'संस्थापक कौन हैं?', 'SRI से संपर्क कैसे करें?'] },
};
const AREAS = [ ['Farm Inputs','/ventures/farm-inputs/','✳'], ['Farm Outputs','/ventures/farm-outputs/','❧'], ['Handloom','/ventures/handloom/','▥'], ['Product Catalogue','/ventures/products/','⬡'] ];
const PAGE_HINTS = [[/founder/,'Who is the founder of SRI?'], [/products/,'Tell me about SRI products'], [/consulting/,'What consulting services do you offer?'], [/industries/,'Which industries does SRI serve?'], [/our-work/,'Show me published projects'], [/insights/,'What articles are available?']];

function BotIcon() {
  return <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="33" fill="#102B50" stroke="#B7CF45" strokeWidth="3"/><path d="M36 14v8" stroke="#B7CF45" strokeWidth="3"/><circle cx="36" cy="12" r="4" fill="#B7CF45"/><rect x="15" y="24" width="42" height="31" rx="12" fill="#F8F3E7"/><rect x="8" y="32" width="8" height="14" rx="3" fill="#B7CF45"/><rect x="56" y="32" width="8" height="14" rx="3" fill="#B7CF45"/><circle cx="28" cy="38" r="4" fill="#102B50"/><circle cx="44" cy="38" r="4" fill="#102B50"/><path d="M29 47q7 6 14 0" fill="none" stroke="#102B50" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}

export default function SriAssistant() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false), [lang,setLang] = useState('en'), [input,setInput] = useState(''), [messages,setMessages] = useState([]), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const dialog = useRef(null), closeBtn = useRef(null), launcher = useRef(null), req = useRef(null), thread = useRef(null), everOpened = useRef(false);
  const t = I18N[lang];
  useEffect(() => { setOpen(false); req.current?.abort(); setBusy(false); }, [pathname]);
  useEffect(() => {
    if (!open) { if (everOpened.current) launcher.current?.focus({preventScroll:true}); return; }
    everOpened.current = true;
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus({preventScroll:true});
    function key(e) {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const els = [...dialog.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')];
      if (!els.length) return;
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length-1].focus(); }
      if (!e.shiftKey && document.activeElement === els[els.length-1]) { e.preventDefault(); els[0].focus(); }
    }
    document.addEventListener('keydown',key);
    return () => { document.body.style.overflow=prior; document.removeEventListener('keydown',key); };
  },[open]);
  useEffect(() => { if(open && thread.current) thread.current.scrollTop=thread.current.scrollHeight; },[messages,busy,open]);
  // SRI V19: dock the floating launcher above the footer.
  // It follows the footer boundary and scrolls out of sight with the page,
  // rather than covering footer navigation, legal links, or back-to-top.
  const launchArea = useRef(null);
  useEffect(() => {
    const node = launchArea.current;
    const footer = document.querySelector('.site-footer');
    if (!node || !footer) return;
    let frame = 0;
    function measure() {
      frame = 0;
      const footerTop = footer.getBoundingClientRect().top;
      const bottom = Number.parseFloat(window.getComputedStyle(node).bottom) || 0;
      const shift = Math.max(0, window.innerHeight - footerTop + 20 - bottom);
      node.style.setProperty('--sri-chat-footer-shift', `${shift}px`);
    }
    function update() {
      if (!frame) frame = window.requestAnimationFrame(measure);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(footer);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [open, pathname]);
  async function ask(text) {
    const q=String(text||'').trim();
    if(!q || busy || q.length>500)return;
    setError('');setInput('');setMessages(m=>[...m,{role:'q',text:q}]);setBusy(true);
    const controller=new AbortController(); req.current=controller;
    try { const r=await api('public/assistant/ask',{method:'POST',data:{question:q,language:lang},signal:controller.signal}); if(!controller.signal.aborted) setMessages(m=>[...m,{role:'a',text:r.answer,sources:r.sources||[]}]); }
    catch(e){ if(!controller.signal.aborted)setError(e.message||'Assistant unavailable.'); }
    finally { if(!controller.signal.aborted)setBusy(false); }
  }
  const hint=PAGE_HINTS.find(([re])=>re.test(pathname))?.[1];
  const prompts=lang==='en' && hint?[hint,...t.prompts.slice(0,3)]:t.prompts;
  return <div className="sri-assistant-ui">
    {!open && <div className="sri-chat-launch-area" ref={launchArea}><div className="sri-chat-nudge">Chat with SRI Assistant <small>English | অসমীয়া | हिन्दी</small></div><button className="sri-chat-launch" type="button" onClick={()=>setOpen(true)} aria-label={t.open} ref={launcher}><BotIcon/></button></div>}
    {open && <div className="sri-chat-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className="sri-notebook" role="dialog" aria-modal="true" aria-label={t.title} ref={dialog}>
      <span className="sri-notebook-tab" aria-hidden="true">SRI Assistant</span><div className="sri-notebook-rings" aria-hidden="true"><i/><i/><i/></div>
      <div className="sri-notebook-paper"><header className="sri-notebook-head"><div><h2>{t.title}</h2><span>{t.desc}</span></div><button type="button" ref={closeBtn} onClick={()=>setOpen(false)} aria-label={t.close}><X size={22}/></button></header>
      <div className="sri-notebook-languages" aria-label="Select conversation language">{[['en','English'],['as','অসমীয়া'],['hi','हिन्दी']].map(([code,label])=><button type="button" key={code} aria-pressed={lang===code} className={lang===code?'active':''} onClick={()=>setLang(code)}>{label}</button>)}</div>
      <div className="sri-notebook-illustration" aria-hidden="true"><svg viewBox="0 0 600 45" preserveAspectRatio="none"><path d="M0 25Q160 -7 310 27T600 23M0 33Q155 2 315 34T600 29M0 40Q150 12 320 39T600 37" fill="none" stroke="#8f9d77" opacity=".8" strokeWidth="1.2"/></svg></div>
      <div className="sri-notebook-thread" ref={thread} aria-live="polite" aria-relevant="additions text">
        {!messages.length && <><div className="sri-notebook-card question"><span>Q.</span><strong>{t.welcome}</strong><b className="bookmark"/></div><div className="sri-notebook-card answer"><span>A.</span><p>{lang==='en'?'I use published website knowledge, not a paid AI service.':lang==='as'?'মই প্ৰকাশিত ৱেবছাইটৰ তথ্য ব্যৱহাৰ কৰোঁ, পেইড AI সেৱা নহয়।':'मैं प्रकाशित वेबसाइट की जानकारी उपयोग करता हूँ, किसी सशुल्क AI सेवा का नहीं।'}</p></div><div className="sri-notebook-section"><BookOpen size={16}/>{t.related}</div><div className="sri-notebook-links">{AREAS.map(([label,url,icon])=><Link key={url} to={url} onClick={()=>setOpen(false)}><em>{icon}</em>{label}<ArrowRight size={14}/></Link>)}</div></>}
        {messages.map((m,i)=><div className={'sri-notebook-card '+(m.role==='q'?'question':'answer')} key={i}><span>{m.role==='q'?'Q.':'A.'}</span><div><p>{m.text}</p>{m.sources?.length>0&&<div className="sri-notebook-sources">{m.sources.map(x=><Link to={x.url} key={x.url} onClick={()=>setOpen(false)}>{x.title}<ExternalLink size={13}/></Link>)}</div>}</div></div>)}
        {busy&&<p role="status" className="sri-notebook-status">{t.busy}</p>}{error&&<p role="alert" className="sri-notebook-error">{error}</p>}
      </div>
      <div className="sri-notebook-bottom"><div className="sri-notebook-handoff"><span>☏</span><div><strong>{t.more}</strong><small>{t.desc}</small></div><Link to="/contact/" onClick={()=>setOpen(false)}>{t.contact}<ArrowRight size={14}/></Link></div><div className="sri-notebook-prompts"><span>{t.ask}:</span>{prompts.map(q=><button key={q} type="button" disabled={busy} onClick={()=>ask(q)}>{q}</button>)}</div><form onSubmit={e=>{e.preventDefault();ask(input);}}><label htmlFor="sri-notebook-input" className="sri-visually-hidden">{t.placeholder}</label><input id="sri-notebook-input" value={input} maxLength={500} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder={t.placeholder}/><button type="submit" disabled={!input.trim()||busy} aria-label="Send question"><Send size={18}/></button></form></div>
      </div>
    </section></div>}
  </div>;
}

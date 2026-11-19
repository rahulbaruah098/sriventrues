import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, Search } from 'lucide-react';
import { useData, dateLabel } from '../lib/api';
import { Resource, Seo } from '../components/ui';
import '../styles/directory-pages.css';

const meta = {
  team: { label: 'Meet the Team', eyebrow: 'THE PEOPLE BEHIND SRI', subtitle: 'Get to know the people working across SRI Ventures & Consulting.', root: '/meet-the-team/' },
  consultants: { label: 'Know Our Consultants', eyebrow: 'OUR PROFESSIONAL NETWORK', subtitle: 'Explore the specialist experience and expertise of our consultants.', root: '/know-our-consultants/' },
  blogs: { label: 'Blogs', eyebrow: 'IDEAS & PERSPECTIVES', subtitle: 'Perspectives, updates and stories published by SRI.', root: '/blogs/' },
};
function nameOf(row, kind) { return kind === 'blogs' ? row.title : row.name; }

// A missing/restricted media file must never render the browser's broken-image
// icon or oversized alt text. The image remains a regular accessible <img>.
function DirectoryImage({ src, alt, detail = false }) {
  const [failed, setFailed] = useState(false);
  const className = detail ? 'sri-directory-detail-image' : undefined;
  if (!src || failed) {
    return <span className={detail ? 'sri-directory-detail-image sri-directory-photo-fallback' : 'sri-directory-photo-fallback'} role="img" aria-label={alt ? `${alt} — photograph unavailable` : 'Photograph unavailable'}>
      <span className="sri-directory-photo-monogram" aria-hidden="true">SRI</span>
      <span className="sri-directory-photo-caption" aria-hidden="true">Photograph unavailable</span>
    </span>;
  }
  return <img className={className} src={src} alt={alt || 'Profile photograph'} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

export function DirectoryPage({ kind }) {
  const m = meta[kind];
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const data = useData('public/directory/' + kind + '?limit=12&page=' + page + '&q=' + encodeURIComponent(query));
  return <main className={`sri-directory sri-directory--${kind} wrap band`}>
    <Seo title={m.label} description={m.subtitle}/>
    <header className="sri-directory-head"><span className="eyebrow">{m.eyebrow}</span><h1>{m.label}</h1><p>{m.subtitle}</p></header>
    <form className="sri-directory-search" onSubmit={e => {e.preventDefault(); setPage(1); setQuery(term);}}>
      <label htmlFor="directory-query">Search {m.label.toLowerCase()}</label>
      <div><Search size={20}/><input id="directory-query" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search by name, topic or expertise"/><button type="submit">Search</button></div>
    </form>
    <Resource value={data}>{result => <>
      {result.items.length ? <div className="sri-directory-grid">{result.items.map(row => <Link to={m.root + row.slug + '/'} key={row.id} className="sri-directory-card">
        <div className="sri-directory-thumb"><DirectoryImage src={row.image} alt={row.image_alt || nameOf(row,kind)}/></div>
        <div className="sri-directory-card-body"><span className="sri-directory-kicker">{kind === 'team' ? row.department : kind === 'consultants' ? row.expertise : row.category}</span><h2>{nameOf(row,kind)}</h2><p>{kind === 'blogs' ? row.summary : row.designation}</p><span className="sri-directory-view">View {kind === 'blogs' ? 'blog' : 'profile'} <ArrowUpRight size={18}/></span></div>
      </Link>)}</div> : <p className="sri-directory-empty">{query ? 'No results for that search.' : 'No published entries yet. Please check back soon.'}</p>}
      {result.total > 12 && <div className="sri-directory-pager"><button disabled={page===1} onClick={() => setPage(v=>Math.max(1,v-1))}>Previous</button><span>Page {page} of {Math.ceil(result.total / 12)}</span><button disabled={page*12 >= result.total} onClick={()=>setPage(v=>v+1)}>Next</button></div>}
    </>}</Resource>
  </main>;
}
export function DirectoryDetail({ kind }) {
  const { slug } = useParams();
  const m = meta[kind];
  const data = useData('public/directory/'+kind+'/'+encodeURIComponent(slug));
  return <main className="sri-directory-detail wrap band"><Resource value={data}>{row => <>
    <Seo title={nameOf(row,kind)} description={row.summary || row.designation}/>
    <Link to={m.root} className="sri-directory-back"><ArrowLeft size={18}/> Back to {m.label}</Link>
    <div className="sri-directory-detail-grid"><div><span className="eyebrow">{kind==='blogs' ? row.category : kind==='team' ? 'MEET THE TEAM' : 'OUR CONSULTANTS'}</span><h1>{nameOf(row,kind)}</h1>
      {kind==='blogs' ? <p>{[row.author,row.published_at && dateLabel(row.published_at)].filter(Boolean).join(' · ')}</p> : <><p className="sri-directory-role">{row.designation}</p>{row.department && <p>{row.department}</p>}{row.expertise && <p>{row.expertise}</p>}{row.qualification && <p><b>Qualifications:</b> {row.qualification}</p>}{row.experience && <p><b>Experience:</b> {row.experience}</p>}</>}
      {row.summary && <p className="sri-directory-intro">{row.summary}</p>}
    </div>{row.image && <DirectoryImage src={row.image} alt={row.image_alt || nameOf(row,kind)} detail/>}</div>
    {row.body && <article className="sri-directory-article" dangerouslySetInnerHTML={{ __html: row.body }}/>}<Link className="sri-directory-contact" to="/contact/">Contact SRI <ArrowUpRight size={18}/></Link>
  </>}</Resource></main>;
}

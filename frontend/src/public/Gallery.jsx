import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "../lib/api";
import { Seo } from "../components/ui";
import "../styles/gallery.css";

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    api(`public/gallery?page=${page}&limit=24`).then((data) => {
      if (!cancelled) { setItems(data.items); setTotal(data.total); setError(""); }
    }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [page]);
  useEffect(() => {
    if (active < 0) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event) => {
      if (event.key === "Escape") setActive(-1);
      if (event.key === "ArrowLeft") setActive((x) => (x + items.length - 1) % items.length);
      if (event.key === "ArrowRight") setActive((x) => (x + 1) % items.length);
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); };
  }, [active, items.length]);
  return <main className="wrap band sri-gallery" id="main-content">
    <Seo title="Gallery | SRI" description="A visual collection of our work, people and partnerships." />
    <header className="sri-gallery-heading"><p className="eyebrow">About SRI / Gallery</p><h1>Our gallery<span>.</span></h1><p>A closer look at the people, places and work behind our journey.</p></header>
    {busy && <p role="status">Loading gallery…</p>}
    {error && <p role="alert">{error} <button className="text-button" onClick={() => setPage((n) => n)}>Try again</button></p>}
    {!busy && !error && !items.length && <div className="sri-gallery-empty">Photographs will be added here soon.</div>}
    <div className="sri-gallery-grid">{items.map((item, index) => <button type="button" className="sri-gallery-tile" key={item.id} onClick={() => setActive(index)} aria-label={`Open ${item.alt || "gallery image"}`}>
      <img src={item.image} alt={item.alt || "Gallery photograph"} loading="lazy" />
      {item.caption && <span className="sri-gallery-caption">{item.caption}</span>}
    </button>)}</div>
    {total > 24 && <nav className="sri-gallery-pagination" aria-label="Gallery pagination"><button type="button" disabled={page === 1} onClick={() => { setPage((n) => n - 1); setActive(-1); }}>Previous</button><span>Page {page} of {Math.ceil(total / 24)}</span><button type="button" disabled={page * 24 >= total} onClick={() => { setPage((n) => n + 1); setActive(-1); }}>Next</button></nav>}
    {active >= 0 && items[active] && <div className="sri-gallery-lightbox" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setActive(-1); }}>
      <div className="sri-gallery-lightbox-inner" role="dialog" aria-modal="true" aria-label="Gallery image viewer">
        <button type="button" className="sri-gallery-close" aria-label="Close viewer" onClick={() => setActive(-1)}><X /></button>
        <button type="button" className="sri-gallery-prev" aria-label="Previous image" onClick={() => setActive((active + items.length - 1) % items.length)}><ChevronLeft /></button>
        <figure><img src={items[active].image} alt={items[active].alt || "Gallery photograph"} />{items[active].caption && <figcaption>{items[active].caption}</figcaption>}</figure>
        <button type="button" className="sri-gallery-next" aria-label="Next image" onClick={() => setActive((active + 1) % items.length)}><ChevronRight /></button>
        <span className="sri-gallery-count">{active + 1} / {items.length}</span>
      </div>
    </div>}
  </main>;
}

import React, { useState } from "react";
import { api, useData } from "../lib/api";
import { AdminTitle, Feedback, Field, Upload, useSave } from "./controls";
import "../styles/gallery.css";

const fresh = () => ({ image: "", caption: "", alt: "", order: 0, status: "draft" });
export default function GalleryAdmin() {
  const result = useData("admin/gallery?limit=100");
  const [doc, setDoc] = useState(fresh());
  const [editing, setEditing] = useState(false);
  const saveState = useSave();
  const set = (key, value) => setDoc((p) => ({ ...p, [key]: value }));
  const save = (e) => { e.preventDefault(); saveState.run(async () => {
    const saved = await api("admin/gallery" + (editing ? "/" + doc.id : ""), { method: editing ? "PUT" : "POST", data: doc });
    setDoc(fresh()); setEditing(false); result.reload();
  }, editing ? "Gallery image updated." : "Gallery image added."); };
  const remove = (item) => {
    if (!window.confirm("Delete this gallery entry? The uploaded file will remain stored.")) return;
    saveState.run(async () => { await api("admin/gallery/" + item.id, { method: "DELETE", data: { version: item.version } }); if (doc.id === item.id) { setDoc(fresh()); setEditing(false); } result.reload(); }, "Gallery entry deleted.");
  };
  return <div className="sri-gallery-admin">
    <AdminTitle title="Gallery management" description="Upload photographs, add optional captions, set their order and control visibility. Only published images are shown on the website."><a href="/about/gallery/" target="_blank" rel="noreferrer">View gallery</a></AdminTitle>
    <form className="panel sri-gallery-admin-editor" onSubmit={save}>
      <h2>{editing ? "Edit photograph" : "Add photograph"}</h2>
      <Upload label="Gallery photograph (required)" value={doc.image} onChange={(v) => set("image", v)} />
      <div className="field-grid">
        <Field label="Caption (optional)" value={doc.caption} maxLength={300} onChange={(v) => set("caption", v)} />
        <Field label="Image description (optional)" value={doc.alt} maxLength={220} onChange={(v) => set("alt", v)} help="Used by screen readers; defaults to the caption or Gallery photograph." />
        <Field label="Display order" type="number" min="0" max="99999" value={doc.order} onChange={(v) => set("order", Number(v) || 0)} />
        <Field label="Visibility" options={["draft", "published"]} value={doc.status} onChange={(v) => set("status", v)} />
      </div>
      <Feedback {...saveState} />
      <div className="sri-gallery-admin-actions"><button type="submit" className="button" disabled={saveState.busy || !doc.image}>{saveState.busy ? "Saving…" : editing ? "Save changes" : "Add to gallery"}</button>{editing && <button type="button" className="text-button" onClick={() => { setDoc(fresh()); setEditing(false); }}>Cancel editing</button>}</div>
    </form>
    <section className="panel"><h2>Uploaded gallery entries</h2>
      {!result.data && <p>Loading gallery entries…</p>}
      {result.error && <p role="alert">{result.error.message}</p>}
      {result.data && !result.data.items.length && <p>There are no gallery entries yet.</p>}
      {result.data && <div className="sri-gallery-admin-list">{result.data.items.map((item) => <article key={item.id} className="sri-gallery-admin-item"><img src={item.image} alt={item.alt || "Gallery photo"} loading="lazy" /><div><strong>{item.caption || "Untitled photograph"}</strong><p>{item.status === "published" ? "Published" : "Draft"} · Order {item.order}</p></div><div className="sri-gallery-admin-actions"><button type="button" disabled={saveState.busy} onClick={() => { setDoc({ ...item }); setEditing(true); window.scrollTo({top: 0, behavior: "smooth"}); }}>Edit</button><button type="button" disabled={saveState.busy} onClick={() => remove(item)}>Delete</button></div></article>)}</div>}
      {result.data && result.data.total > 100 && <p>Showing the first 100 entries. More entries can be added; management pagination will be needed for very large galleries.</p>}
    </section>
  </div>;
}

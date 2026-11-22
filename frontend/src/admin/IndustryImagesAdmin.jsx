import React, { useEffect, useState } from "react";
import content from "@shared/content.json";
import { api, useData } from "../lib/api";
import { AdminTitle, Feedback, Field, Upload, useSave } from "./controls";

function IndustryImageEditor({ industry, initial, reload }) {
  const [image, setImage] = useState(initial?.image || "");
  const [alt, setAlt] = useState(initial?.alt || "");
  const state = useSave();
  useEffect(() => { setImage(initial?.image || ""); setAlt(initial?.alt || ""); }, [initial?.image, initial?.alt]);
  function save(event) {
    event.preventDefault();
    state.run(async () => {
      await api(`admin/industry-images/${industry.slug}`, {
        method: "PUT", data: { image, alt, version: initial?.version || 0 },
      });
      reload();
    }, image ? "Industry image saved." : "Custom image removed; original image will be shown.");
  }
  return <form className="panel" onSubmit={save} style={{ padding: 22, marginBottom: 16 }}>
    <h2>{industry.title}</h2>
    <p style={{ marginBottom: 12 }}>Appears when visitors hover over or focus this industry on the homepage.</p>
    <Upload label="Industry image (JPG, PNG or WebP)" value={image} onChange={setImage} />
    <Field label="Image description (optional)" value={alt} maxLength={220} onChange={setAlt} />
    {!image && <small>The original website photograph will be used until you upload and save an image.</small>}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
      <button type="submit" className="button" disabled={state.busy}>{state.busy ? "Saving…" : "Save image"}</button>
      {image && <button type="button" className="text-button" onClick={() => setImage("")}>Use original image</button>}
    </div>
    <Feedback {...state} />
  </form>;
}

export default function IndustryImagesAdmin() {
  const result = useData("admin/industry-images");
  const images = Object.fromEntries((result.data?.items || []).map((item) => [item.slug, item]));
  return <div>
    <AdminTitle title="Industries images" description="Manage the photo for each industry on the homepage. Uploading images does not change the existing hover or scroll animations, industry links, or ordering.">
      <a href="/" target="_blank" rel="noreferrer">View homepage</a>
    </AdminTitle>
    {result.error && <p role="alert">{result.error.message} <button onClick={result.reload}>Retry</button></p>}
    {!result.data && !result.error && <p>Loading industry images…</p>}
    {result.data && content.industries.map((industry) => <IndustryImageEditor key={industry.slug} industry={industry} initial={images[industry.slug]} reload={result.reload} />)}
  </div>;
}

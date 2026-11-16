import React, { lazy, Suspense, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import content from "@shared/content.json";
import { Resource } from "../components/ui";
import { Pager } from "../public/Collections";
import { labels, api, toQuery, useData, dateLabel } from "../lib/api";
import { announcePublication } from "../lib/context";
import {
  AdminTitle,
  Feedback,
  Field,
  Upload,
  useSave,
  patcher,
} from "./controls";
const RichEditor = lazy(() => import("./RichEditor"));
const singular = {
  articles: "article",
  "case-studies": "case study",
  products: "product",
};
export function ContentList({ kind }) {
  const [params, setParams] = useSearchParams(),
    q = params.get("q") || "",
    status = params.get("status") || "",
    page = Number(params.get("page")) || 1;
  const [term, setTerm] = useState(q);
  const update = (values) =>
    setParams(toQuery({ q, status, page: 1, ...values }));
  const r = useData(
    "admin/content/" + kind + "?" + toQuery({ q, status, page, limit: 15 }),
  );
  return (
    <>
      <AdminTitle title={labels[kind]}>
        <Link className="button" to={"/admin/" + kind + "/new"}>
          New {singular[kind]}
        </Link>
      </AdminTitle>
      <form
        className="filterbar"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: term });
        }}
      >
        <Field label="Search" value={term} onChange={setTerm} />
        <label>
          Status
          <select
            value={status}
            onChange={(e) => update({ status: e.target.value, q: term })}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button className="button">Search</button>
      </form>
      <Resource value={r}>
        {(d) => (
          <>
            {d.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Title", "Category", "Status", "Updated", ""].map(
                        (c, i) => (
                          <th key={i}>{c}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((x) => (
                      <tr key={x.id}>
                        <td>{x.title}</td>
                        <td>{x.category}</td>
                        <td>
                          <span className={"status " + x.status}>
                            {x.status}
                          </span>
                        </td>
                        <td>{dateLabel(x.updated_at)}</td>
                        <td>
                          <Link to={"/admin/" + kind + "/" + x.id}>Edit</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel">No matching records.</p>
            )}
            <Pager {...d} change={(page) => update({ page })} />
          </>
        )}
      </Resource>
    </>
  );
}
const fresh = {
  title: "",
  slug: "",
  category: "",
  excerpt: "",
  status: "draft",
  cover: "",
  cover_alt: "",
  body: "",
  order: 0,
  gallery: [],
  related_services: [],
  featured: false,
};
const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
function Editor({ kind, initial }) {
  const [doc, setDoc] = useState({ ...fresh, ...initial }),
    set = patcher(setDoc),
    state = useSave(),
    navigate = useNavigate();
  const [customSlug, setCustomSlug] = useState(!!initial.id);
  const props = (k) => ({ value: doc[k] ?? "", onChange: (v) => set(k, v) });
  const cats =
    kind === "articles"
      ? content.articleCategories
      : kind === "products"
        ? content.ventures.map((x) => x.title)
        : content.industries.map((x) => x.title);
  async function save(status) {
    await state.run(
      async () => {
        const dest = "admin/content/" + kind;
        const result = await api(dest + (doc.id ? "/" + doc.id : ""), {
          method: doc.id ? "PUT" : "POST",
          data: { ...doc, status },
        });
        setDoc(result);
        announcePublication();
        if (!doc.id)
          navigate("/admin/" + kind + "/" + result.id, {
            replace: true,
            state: { saved: status },
          });
      },
      status === "published" ? "Published to the website." : "Saved as draft.",
    );
  }
  const gallery = doc.gallery || [];
  return (
    <>
      <Link className="back" to={"/admin/" + kind}>
        ← {labels[kind]}
      </Link>
      <AdminTitle
        title={(doc.id ? "Edit " : "New ") + singular[kind]}
        description={"Current status · " + doc.status}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(e.nativeEvent.submitter?.value || "draft");
        }}
        className="editor-form"
      >
        <div className="panel field-grid">
          <Field
            label="Title"
            wide
            required
            maxLength={220}
            value={doc.title}
            onChange={(v) =>
              setDoc((d) => ({
                ...d,
                title: v,
                slug: customSlug ? d.slug : slugify(v),
              }))
            }
          />
          <Field
            label="URL slug"
            required
            value={doc.slug}
            onChange={(v) => {
              setCustomSlug(true);
              set("slug", v);
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={180}
          />
          <Field label="Category" options={cats} {...props("category")} />
          <Field
            wide
            label={
              kind === "products" ? "Short description" : "Summary / excerpt"
            }
            type="textarea"
            maxLength={1200}
            {...props("excerpt")}
          />
          <Field
            label="Display order"
            type="number"
            min="0"
            max="99999"
            {...props("order")}
          />
          {kind === "articles" && <Field label="Author" {...props("author")} />}
        </div>
        <div className="panel field-grid">
          <Upload
            label="Cover image"
            value={doc.cover}
            onChange={(v) => set("cover", v)}
          />
          <Field label="Cover image description" {...props("cover_alt")} />
        </div>
        {kind === "articles" ? (
          <div className="panel">
            <label className="check">
              <input
                type="checkbox"
                checked={doc.featured}
                onChange={(e) => set("featured", e.target.checked)}
              />
              Feature in the journal
            </label>
            <Suspense fallback={<p>Loading editor…</p>}>
              <RichEditor value={doc.body} onChange={(v) => set("body", v)} />
            </Suspense>
          </div>
        ) : (
          <>
            <div className="panel field-grid">
              {kind === "products" ? (
                <>
                  {[
                    "manufacturer",
                    "pack_size",
                    "availability",
                    "description",
                    "specifications",
                  ].map((k, i) => (
                    <Field
                      key={k}
                      label={
                        [
                          "Brand / manufacturer",
                          "Pack size",
                          "Availability",
                          "Detailed description",
                          "Specifications",
                        ][i]
                      }
                      type={i > 2 ? "textarea" : "text"}
                      wide={i > 2}
                      {...props(k)}
                    />
                  ))}
                </>
              ) : (
                <>
                  <Field
                    label="Authorised client / project name"
                    {...props("client")}
                  />
                  <Field
                    label="Vertical"
                    options={[
                      "SRI Ventures",
                      "SRI Consulting",
                      "Both verticals",
                    ]}
                    {...props("vertical")}
                  />
                  {["challenge", "role", "intervention", "outcomes"].map(
                    (k, i) => (
                      <Field
                        wide
                        key={k}
                        label={
                          [
                            "Challenge",
                            "SRI’s actual role",
                            "Intervention / methodology",
                            "Verified outcomes",
                          ][i]
                        }
                        type="textarea"
                        {...props(k)}
                      />
                    ),
                  )}
                  <label className="wide">
                    Related services{" "}
                    <small>
                      Use Ctrl or Command to select multiple entries.
                    </small>
                    <select
                      multiple
                      value={doc.related_services}
                      onChange={(e) =>
                        set(
                          "related_services",
                          Array.from(e.target.selectedOptions, (x) => x.value),
                        )
                      }
                    >
                      {Object.entries(content.pages)
                        .filter(([p]) => /^\/(consulting|ventures)\/.+/.test(p))
                        .map(([p, v]) => (
                          <option key={p} value={p}>
                            {v.title}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
            </div>
            <section className="panel">
              <h2>Image gallery</h2>
              {gallery.map((g, i) => (
                <div className="gallery-edit" key={i}>
                  <img src={g.url} alt={g.alt || "Gallery preview"} />
                  <Field
                    label="Image description"
                    value={g.alt}
                    onChange={(v) =>
                      set(
                        "gallery",
                        gallery.map((x, j) => (j === i ? { ...x, alt: v } : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      set(
                        "gallery",
                        gallery.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove image
                  </button>
                </div>
              ))}
              <Upload
                label="Add gallery image"
                onChange={(url) =>
                  setDoc((d) => ({
                    ...d,
                    gallery: [...(d.gallery || []), { url, alt: "" }],
                  }))
                }
              />
            </section>
          </>
        )}
        <div className="panel field-grid">
          <Field label="SEO title" maxLength={160} {...props("seo_title")} />
          <Field
            label="Meta description"
            maxLength={400}
            {...props("seo_description")}
          />
        </div>
        <Feedback {...state} />
        <div className="editor-actions">
          <button className="button" value="published" disabled={state.busy}>
            Publish
          </button>
          <button
            className="button secondary"
            value="draft"
            disabled={state.busy}
            onClick={(e) => {
              if (
                doc.status === "published" &&
                !window.confirm("Unpublish this item and save it as a draft?")
              )
                e.preventDefault();
            }}
          >
            {doc.status === "published" ? "Unpublish to draft" : "Save draft"}
          </button>
          {doc.id && (
            <button
              className="text-button danger"
              type="button"
              disabled={state.busy}
              onClick={() => {
                if (window.confirm("Permanently delete “" + doc.title + "”?"))
                  state.run(async () => {
                    await api("admin/content/" + kind + "/" + doc.id, {
                      method: "DELETE",
                      data: { version: doc.version },
                    });
                    announcePublication();
                    navigate("/admin/" + kind);
                  });
              }}
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </>
  );
}
export function ContentEditor({ kind }) {
  const { id } = useParams(),
    r = useData(id === "new" ? null : "admin/content/" + kind + "/" + id);
  if (id === "new")
    return <Editor key={kind + "new"} kind={kind} initial={fresh} />;
  return (
    <Resource value={r}>
      {(doc) => <Editor key={doc.id} kind={kind} initial={doc} />}
    </Resource>
  );
}

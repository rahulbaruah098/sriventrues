import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, dateLabel, labels, useData } from "../lib/api";
import { announcePublication } from "../lib/context";
import { Resource } from "../components/ui";
import {
  AdminTitle,
  Feedback,
  Field,
  Upload,
  useSave,
  patcher,
} from "./controls";

function PageForm({ kind, initial }) {
  const [doc, setDoc] = useState(initial),
    [draft, setDraft] = useState(initial.draft),
    state = useSave(),
    set = patcher(setDraft);
  const isApproach = kind === "approach",
    field = isApproach ? "stages" : "milestones",
    rows = draft[field];
  const updateRow = (index, key, value) =>
    setDraft((d) => ({
      ...d,
      [field]: d[field].map((r, i) =>
        i === index ? { ...r, [key]: value } : r,
      ),
    }));
  const move = (index, step) => {
    const next = [...rows];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    set(field, next);
  };
  async function submit(e) {
    e.preventDefault();
    const action = e.nativeEvent.submitter?.value || "draft";
    await state.run(
      async () => {
        const result = await api("admin/pages/" + kind, {
          method: "PUT",
          data: { version: doc.version, draft, action },
        });
        setDoc(result);
        setDraft(result.draft);
        if (action === "publish") announcePublication();
      },
      action === "publish"
        ? "Published to the website."
        : "Working draft saved. The public version is unchanged.",
    );
  }
  return (
    <>
      <AdminTitle
        title={labels[kind]}
        description={"Last publication · " + dateLabel(doc.published_at, true)}
      >
        <Link
          className="text-button"
          to={isApproach ? "/our-approach/" : "/know-the-founder/"}
          target="_blank"
        >
          View public page ↗
        </Link>
      </AdminTitle>
      <form className="editor-form" onSubmit={submit}>
        <section className="panel field-grid">
          <Field
            wide
            label="Page heading"
            required
            value={draft.heading}
            onChange={(v) => set("heading", v)}
          />
          <Field
            wide
            label="Introduction"
            type="textarea"
            value={draft.intro}
            onChange={(v) => set("intro", v)}
          />
          {!isApproach && (
            <>
              <Field
                label="Verified founder name"
                value={draft.name}
                onChange={(v) => set("name", v)}
              />
              <Field
                label="Role / designation"
                value={draft.role}
                onChange={(v) => set("role", v)}
              />
              <Field
                label="Approved biography"
                wide
                type="textarea"
                rows={8}
                value={draft.bio}
                onChange={(v) => set("bio", v)}
                help="Confirm the proposed biography before publishing."
              />
              <Upload
                label="Founder portrait"
                value={draft.portrait}
                onChange={(v) => set("portrait", v)}
              />
              <Field
                label="Portrait description"
                value={draft.alt}
                onChange={(v) => set("alt", v)}
              />
            </>
          )}
        </section>
        <h2>
          {isApproach
            ? "Approach stages"
            : "Attributed professional milestones"}
        </h2>
        {!isApproach && (
          <p>
            For previous assignments, identify the organisation where the
            founder carried out the work.
          </p>
        )}
        {rows.map((row, i) => (
          <section className="panel" key={i}>
            <div className="row-tools">
              <h3>
                {isApproach ? "Stage" : "Milestone"} {i + 1}
              </h3>
              <div>
                <button
                  type="button"
                  className="text-button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  Move up
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Move down
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm("Remove this entry from the working copy?")
                    )
                      set(
                        field,
                        rows.filter((_, j) => i !== j),
                      );
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="field-grid">
              {isApproach ? (
                <>
                  <Field
                    label="Stage name"
                    required
                    value={row.name}
                    onChange={(v) => updateRow(i, "name", v)}
                  />
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        updateRow(i, "enabled", e.target.checked)
                      }
                    />{" "}
                    Show stage when published
                  </label>
                </>
              ) : (
                <>
                  <Field
                    label="Period / year"
                    value={row.period}
                    onChange={(v) => updateRow(i, "period", v)}
                  />
                  <Field
                    label="Organisation"
                    required
                    value={row.organisation}
                    onChange={(v) => updateRow(i, "organisation", v)}
                  />
                </>
              )}
              <Field
                wide
                label="Description"
                type="textarea"
                required
                value={row.description}
                onChange={(v) => updateRow(i, "description", v)}
              />
              {isApproach && (
                <>
                  <Upload
                    label="Supporting image"
                    value={row.image}
                    onChange={(v) => updateRow(i, "image", v)}
                  />
                  <Field
                    label="Image description"
                    value={row.alt}
                    onChange={(v) => updateRow(i, "alt", v)}
                  />
                </>
              )}
            </div>
          </section>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            set(field, [
              ...rows,
              isApproach
                ? {
                    name: "",
                    description: "",
                    image: "",
                    alt: "",
                    enabled: true,
                  }
                : { period: "", organisation: "", description: "" },
            ])
          }
        >
          Add {isApproach ? "stage" : "milestone"}
        </button>
        <Feedback {...state} />
        <div className="editor-actions">
          <button className="button" value="publish" disabled={state.busy}>
            Publish page
          </button>
          <button
            className="button secondary"
            value="draft"
            disabled={state.busy}
          >
            Save working draft
          </button>
        </div>
      </form>
    </>
  );
}
export function PageEditor({ kind }) {
  const r = useData("admin/pages/" + kind);
  return (
    <Resource value={r}>
      {(d) => <PageForm key={kind} kind={kind} initial={d} />}
    </Resource>
  );
}

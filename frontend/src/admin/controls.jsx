import React, { useState } from "react";
import { api } from "../lib/api";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  required = false,
  wide = false,
  help,
  ...attrs
}) {
  const props = {
    value: value ?? "",
    onChange: (e) => onChange(e.target.value),
    required,
    ...attrs,
  };
  return (
    <label className={"field " + (wide ? "wide" : "")}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {options ? (
        <select {...props}>
          <option value="">Select an option</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea rows={4} {...props} />
      ) : (
        <input type={type} {...props} />
      )}
      {help && <small>{help}</small>}
    </label>
  );
}
export function Feedback({ error, success }) {
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
export function useSave() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function run(fn, message = "Changes saved.") {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, run };
}
export function Upload({
  label = "Image",
  value,
  onChange,
  purpose = "content",
}) {
  const state = useSave(),
    pdf = purpose === "profile";
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await state.run(async () => {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Choose a file up to 8 MB.");
      const form = new FormData();
      form.append("purpose", purpose);
      form.append("file", file);
      const result = await api("admin/media", { method: "POST", form });
      onChange(result.url);
    }, "Uploaded. Save the form to use this file.");
  }
  return (
    <div className="upload">
      <label>
        <span>{label}</span>
        <input
          type="file"
          disabled={state.busy}
          accept={pdf ? ".pdf" : ".png,.webp,.jpg,.jpeg,.svg"}
          onChange={pick}
        />
      </label>
      {value && (
        <div className="upload-current">
          {pdf ? (
            <a href={value}>Download current PDF</a>
          ) : (
            <img src={value} alt={"Current " + label.toLowerCase()} />
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => onChange("")}
          >
            Remove
          </button>
        </div>
      )}
      {state.busy && <small role="status">Uploading…</small>}
      <Feedback {...state} />
    </div>
  );
}
export const patcher = (set) => (key, value) =>
  set((old) => ({ ...old, [key]: value }));
export function AdminTitle({ title, description, children }) {
  return (
    <header className="admin-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}

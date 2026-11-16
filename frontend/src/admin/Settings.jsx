import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, useData } from "../lib/api";
import { announcePublication, useSettings } from "../lib/context";
import { Brand } from "../components/layout";
import { Resource } from "../components/ui";
import {
  AdminTitle,
  Feedback,
  Field,
  Upload,
  useSave,
  patcher,
} from "./controls";

function SettingsForm({ initial, branding }) {
  const [doc, setDoc] = useState(initial),
    set = patcher(setDoc),
    state = useSave();
  const publicSettings = useSettings();
  const fields = branding
    ? ["logo", "logo_width"]
    : [
        "name",
        "tagline",
        "address",
        "email",
        "phone",
        "whatsapp",
        "hours",
        "seo_title",
        "seo_description",
        "privacy",
        "terms",
        "socials",
        "profile_file",
      ];
  async function save(e) {
    e.preventDefault();
    await state.run(async () => {
      const patch = Object.fromEntries(fields.map((k) => [k, doc[k]]));
      const result = await api("admin/settings", {
        method: "PUT",
        data: { ...patch, version: doc.version },
      });
      setDoc(result);
      announcePublication();
    });
  }
  const values = (key) => ({ value: doc[key], onChange: (v) => set(key, v) });
  return (
    <>
      <AdminTitle
        title={branding ? "Company branding" : "Website settings"}
        description={
          branding
            ? "One official logo is used throughout the public website."
            : "Publish verified company, contact and website information."
        }
      />
      <form className="editor-form" onSubmit={save}>
        {branding ? (
          <>
            <section className="panel field-grid">
              <Upload
                label="Official company logo"
                purpose="logo"
                {...values("logo")}
              />
              <Field
                label="Maximum logo width (px)"
                type="number"
                min={84}
                max={240}
                required
                {...values("logo_width")}
              />
            </section>
            <section className="panel">
              <h2>Preview</h2>
              <h3>Navbar</h3>
              <div className="brand-preview">
                <Brand settings={doc} />
              </div>
              <h3>Footer</h3>
              <div className="brand-preview dark">
                <span className={doc.logo ? "logo-plate" : ""}>
                  <Brand settings={doc} />
                </span>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="panel field-grid">
              {[
                ["name", "Company name"],
                ["tagline", "Corporate tagline"],
                ["address", "Registered office / address"],
                ["email", "Contact email"],
                ["phone", "Telephone"],
                ["whatsapp", "WhatsApp number"],
                ["hours", "Business hours"],
                ["seo_title", "Homepage SEO title"],
                ["seo_description", "Homepage meta description"],
              ].map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  required={k === "name"}
                  type={
                    k === "email"
                      ? "email"
                      : k === "address" || k === "seo_description"
                        ? "textarea"
                        : "text"
                  }
                  {...values(k)}
                />
              ))}
            </div>
            <div className="panel">
              <h2>Official social channels</h2>
              {doc.socials.map((row, i) => (
                <div className="field-grid" key={i}>
                  {["label", "url"].map((k) => (
                    <Field
                      key={k}
                      required
                      label={k === "label" ? "Channel name" : "Channel URL"}
                      type={k === "url" ? "url" : "text"}
                      value={row[k]}
                      onChange={(v) =>
                        set(
                          "socials",
                          doc.socials.map((x, j) =>
                            i === j ? { ...x, [k]: v } : x,
                          ),
                        )
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      set(
                        "socials",
                        doc.socials.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove channel
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  set("socials", [...doc.socials, { label: "", url: "" }])
                }
              >
                Add channel
              </button>
            </div>
            {publicSettings.newsletter && (
              <div className="panel">
                <h2>Insights subscribers</h2>
                <a
                  className="action link"
                  href="/api/admin/newsletter/export.csv"
                  download
                >
                  Export confirmed subscribers
                </a>
              </div>
            )}
            <div className="panel">
              <Upload
                label="Approved corporate profile PDF"
                purpose="profile"
                value={doc.profile_file}
                onChange={(v) => set("profile_file", v)}
              />
            </div>
            <div className="panel field-grid">
              <Field
                wide
                label="Approved privacy policy"
                type="textarea"
                rows={7}
                {...values("privacy")}
              />
              <Field
                wide
                label="Approved terms"
                type="textarea"
                rows={7}
                {...values("terms")}
              />
            </div>
          </>
        )}
        <Feedback {...state} />
        <button className="button" disabled={state.busy}>
          {state.busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </>
  );
}
export function SettingsEditor({ branding = false }) {
  const r = useData("admin/settings");
  return (
    <Resource value={r}>
      {(d) => (
        <SettingsForm key={String(branding)} initial={d} branding={branding} />
      )}
    </Resource>
  );
}
export function Account() {
  const { user, refreshSession } = useOutletContext(),
    [form, setForm] = useState({
      email: user.email,
      password: "",
      current_password: "",
    }),
    state = useSave(),
    set = patcher(setForm);
  return (
    <>
      <AdminTitle
        title="Admin account"
        description="Change your sign-in email or password. Saving signs out your other sessions."
      />
      <form
        className="panel editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          state.run(async () => {
            await api("auth/account", { method: "PUT", data: form });
            refreshSession();
            setForm((x) => ({ ...x, password: "", current_password: "" }));
          });
        }}
      >
        <Field
          label="Login email"
          type="email"
          required
          value={form.email}
          onChange={(v) => set("email", v)}
        />
        <Field
          label="New password (optional)"
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={form.password}
          onChange={(v) => set("password", v)}
        />
        <Field
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          value={form.current_password}
          onChange={(v) => set("current_password", v)}
        />
        <Feedback {...state} />
        <button className="button" disabled={state.busy}>
          Update account
        </button>
      </form>
    </>
  );
}

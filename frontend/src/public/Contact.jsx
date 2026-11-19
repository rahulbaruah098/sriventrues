import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import content from "@shared/content.json";
import { api, labels } from "../lib/api";
import { useSettings } from "../lib/context";
import { Crumbs, Eyebrow, Seo } from "../components/ui";

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    s.slice(0, 8),
    s.slice(8, 12),
    s.slice(12, 16),
    s.slice(16, 20),
    s.slice(20),
  ].join("-");
}
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

function TurnstileField({ onToken, resetVersion }) {
  const mount = useRef(null);
  const widgetId = useRef(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !mount.current) return;
    let active = true;
    const render = () => {
      if (!active || !mount.current || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(mount.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => active && onToken(token),
        "expired-callback": () => active && onToken(""),
        "error-callback": () => { if (active) onToken(""); },
      });
    };
    const scriptId = "sri-cloudflare-turnstile-api";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    if (window.turnstile) render();
    return () => {
      active = false;
      script?.removeEventListener("load", render);
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch (_) { /* already removed */ }
      }
      widgetId.current = null;
    };
  }, [onToken]);
  useEffect(() => {
    if (resetVersion > 0 && widgetId.current !== null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetVersion]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div className="turnstile-field"><div ref={mount} /><p className="form-note">Security verification is required to submit this enquiry.</p></div>;
}

function EnquiryForm({ kind, params }) {
  const fields = content.forms[kind],
    reduced = useReducedMotion();
  const defaults = () =>
    Object.fromEntries(
      fields.map((f) => {
        const v = params.get(f.key) || "";
        return [
          f.key,
          f.options && !f.options.includes(v) ? "" : v.slice(0, 260),
        ];
      }),
    );
  const [form, setForm] = useState(defaults),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [turnstileToken, setTurnstileToken] = useState(""),
    [turnstileReset, setTurnstileReset] = useState(0);
  const [error, setError] = useState(""),
    [reference, setReference] = useState("");
  const requestId = useRef(newId()),
    trap = useRef(),
    lock = useRef(false),
    success = useRef();
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Complete the human verification before submitting.");
      return;
    }
    setBusy(true);
    lock.current = true;
    try {
      const result = await api("public/enquiries", {
        method: "POST",
        data: {
          type: kind,
          data: form,
          request_id: requestId.current,
          consent,
          website: trap.current.value,
          turnstile_token: turnstileToken,
        },
      });
      setReference(result.reference);
      requestAnimationFrame(() => success.current?.focus());
    } catch (err) {
      setError(err.message);
      setTurnstileToken("");
      setTurnstileReset((v) => v + 1);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (reference)
    return (
      <div className="receipt" role="status" tabIndex={-1} ref={success}>
        <Check size={28} />
        <h2>Enquiry received.</h2>
        <p>
          Your {labels[kind]} enquiry has been recorded. Keep this reference for
          follow-up.
        </p>
        <strong>{reference}</strong>
        <button
          className="text-button"
          onClick={() => {
            requestId.current = newId();
            setReference("");
            setForm(defaults());
            setConsent(false);
            setTurnstileToken("");
          }}
        >
          Start another enquiry
        </button>
      </div>
    );
  return (
    <motion.form
      className="enquiry-form"
      initial={reduced ? false : { opacity: 0.7, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      onSubmit={submit}
    >
      <h2>{labels[kind]} enquiry</h2>
      <p className="form-note">Fields marked * are required.</p>
      <div className="field-grid">
        {fields.map((f) => {
          const id = "field-" + f.key,
            common = {
              id,
              name: f.key,
              value: form[f.key],
              required: f.required,
              maxLength: f.type === "textarea" ? 3500 : 260,
              onChange: (e) => setForm({ ...form, [f.key]: e.target.value }),
            };
          return (
            <label
              className={f.type === "textarea" ? "wide" : ""}
              key={id}
              htmlFor={id}
            >
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.type === "select" ? (
                <select {...common}>
                  <option value="">Select an option</option>
                  {f.options.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea rows={3} {...common} />
              ) : (
                <input
                  {...common}
                  type={f.type}
                  autoComplete={
                    {
                      name: "name",
                      organisation: "organization",
                      email: "email",
                      phone: "tel",
                    }[f.key]
                  }
                  pattern={
                    f.type === "tel"
                      ? "[0-9\\s\\+\\(\\)\\.\\-]{6,32}"
                      : undefined
                  }
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} ref={trap} autoComplete="off" />
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          required
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          I agree that SRI may use these details to respond to my enquiry.{" "}
          <Link to="/privacy/" target="_blank" rel="noopener">
            Privacy notice
          </Link>
        </span>
      </label>
      <TurnstileField onToken={setTurnstileToken} resetVersion={turnstileReset} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button" disabled={busy || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}>
        {busy ? "Submitting…" : "Submit enquiry"}
        <ArrowRight size={17} />
      </button>
    </motion.form>
  );
}
export default function Contact() {
  const [params, setParams] = useSearchParams(),
    requested = params.get("type"),
    kind = Object.hasOwn(content.forms, requested) ? requested : "general",
    s = useSettings();
  return (
    <>
      <Seo
        title="Contact us"
        description={content.pages["/contact/"].description}
      />
      <section className="wrap">
        <Crumbs items={[["Contact us"]]} />
      </section>
      <section className="wrap band contact-layout">
        <div className="contact-intro">
          <Eyebrow>Contact SRI</Eyebrow>
          <h1>Let’s build opportunities together.</h1>
          <p className="lead">{content.pages["/contact/"].description}</p>
          <div className="contact-details">
            {s.address && <p>{s.address}</p>}
            {s.email && <a href={"mailto:" + s.email}>{s.email}</a>}
            {s.phone && <a href={"tel:" + s.phone}>{s.phone}</a>}
            {s.hours && <p>{s.hours}</p>}
          </div>
        </div>
        <div>
          <label className="enquiry-type-label" htmlFor="enquiry-type">
            <span>What is your enquiry about? *</span>
            <select
              id="enquiry-type"
              value={kind}
              onChange={(e) => setParams({ type: e.target.value })}
            >
              {Object.keys(content.forms).map((k) => (
                <option key={k} value={k}>{labels[k]}</option>
              ))}
            </select>
          </label>
          <EnquiryForm key={params.toString()} kind={kind} params={params} />
        </div>
      </section>
    </>
  );
}

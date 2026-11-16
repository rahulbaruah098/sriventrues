import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSettings } from "../lib/context";
import { Intro, Seo } from "../components/ui";

export function Subscription() {
  const s = useSettings(),
    [email, setEmail] = useState(""),
    [agree, setAgree] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState("");
  if (!s.newsletter) return null;
  return (
    <section className="newsletter">
      <h2>Insights by email.</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setResult("");
          try {
            await api("public/newsletter", {
              method: "POST",
              data: { email, consent: agree },
            });
            setResult(
              "If confirmation is needed, a link will arrive by email.",
            );
            setEmail("");
            setAgree(false);
          } catch (err) {
            setResult(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email address
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            required
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          I would like SRI to email me its published insights.
        </label>
        <button className="button" disabled={busy}>
          Request subscription
        </button>
        <p role="status">{result}</p>
      </form>
    </section>
  );
}
export default function Newsletter() {
  const params = new URLSearchParams(location.hash.slice(1)),
    action = params.has("unsubscribe") ? "unsubscribe" : "confirm";
  const token = params.get(action),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [done, setDone] = useState(false);
  return (
    <>
      <Seo
        noindex
        title="Newsletter preferences"
        description="Manage a subscription to SRI Insights."
      />
      <Intro title="Newsletter preferences" over="SRI Insights" />
      <section className="wrap band">
        {token && !done ? (
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("public/newsletter/manage", {
                  method: "POST",
                  data: { action, token },
                });
                setDone(true);
                setResult(
                  action === "unsubscribe"
                    ? "You have been unsubscribed."
                    : "Your subscription is confirmed.",
                );
              } catch (e) {
                setResult(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {action === "unsubscribe"
              ? "Confirm unsubscribe"
              : "Confirm subscription"}
          </button>
        ) : (
          !done && <p>Use the private link sent to your email address.</p>
        )}
        <p role="status">{result}</p>
        <Link className="action link" to="/insights/">
          Back to Insights
        </Link>
      </section>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSettings } from "../lib/context";

function stored() {
  try {
    return localStorage.getItem("sri-analytics-consent") === "yes";
  } catch {
    return false;
  }
}
export default function AnalyticsPreference() {
  const settings = useSettings(),
    { pathname } = useLocation(),
    [consent, setConsent] = useState(stored);
  const id = settings.analytics_id;
  const protectedBrowser =
    navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  useEffect(() => {
    if (!id || protectedBrowser || !consent) return;
    window["ga-disable-" + id] = false;
    if (!document.getElementById("sri-analytics")) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      const script = document.createElement("script");
      script.id = "sri-analytics";
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
      document.head.appendChild(script);
    }
    window.gtag("event", "page_view", {
      page_location: location.origin + pathname,
      page_path: pathname,
      page_title: document.title,
    });
  }, [id, consent, protectedBrowser, pathname]);
  if (!id || protectedBrowser) return null;
  function change() {
    const next = !consent;
    try {
      localStorage.setItem("sri-analytics-consent", next ? "yes" : "no");
    } catch {
      /* Apply for this page. */
    }
    window["ga-disable-" + id] = !next;
    setConsent(next);
  }
  return (
    <button
      type="button"
      className="analytics-choice"
      aria-pressed={consent}
      onClick={change}
    >
      {consent ? "Disable optional analytics" : "Allow optional analytics"}
    </button>
  );
}

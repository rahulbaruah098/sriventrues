import { useCallback, useEffect, useState } from "react";

let token = "";
export const setToken = (value) => {
  token = value || "";
};

export async function api(path, options = {}) {
  const { data, method = "GET", signal, form } = options;
  const headers = { Accept: "application/json" };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && token) headers["X-CSRF-Token"] = token;
  let res;
  try {
    res = await fetch("/api/" + path, {
      method,
      headers,
      credentials: "same-origin",
      signal,
      body: form || (data === undefined ? undefined : JSON.stringify(data)),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(
      "Could not reach the website. Check your connection and try again.",
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path.startsWith("admin/"))
      window.dispatchEvent(new Event("sri:session-expired"));
    const err = new Error(body.error || "The request could not be completed.");
    err.status = res.status;
    throw err;
  }
  if (body.csrf) setToken(body.csrf);
  return body;
}

export function useData(path) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  const [state, setState] = useState({ path: null, data: null, error: null });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ path, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ path, data: null, error });
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    ...(state.path === path ? state : { data: null, error: null }),
    reload,
  };
}

export function dateLabel(value, time = false) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export const catalogueBases = {
  articles: "/insights/",
  "case-studies": "/our-work/",
  products: "/ventures/products/",
};
export const labels = {
  articles: "Insights & Articles",
  "case-studies": "Our Work / Case Studies",
  products: "Product Catalogue",
  founder: "Know the Founder",
  approach: "Our Approach",
  general: "General contact",
  ventures: "SRI Ventures",
  consulting: "SRI Consulting",
  partnerships: "Partnerships",
};
export const statuses = ["New", "In Progress", "Responded", "Closed"];
export const toQuery = (values) =>
  new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== "" && v != null),
  ).toString();
export const contactLink = (type, data = {}) =>
  "/contact/?" + toQuery({ type, ...data });

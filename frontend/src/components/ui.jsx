import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import content from "@shared/content.json";
import { useSettings } from "../lib/context";

export function Seo({
  title,
  description,
  image,
  type = "website",
  noindex = false,
  published,
  author,
}) {
  const { pathname } = useLocation();
  const settings = useSettings();
  useEffect(() => {
    const full =
      pathname === "/"
        ? settings.seo_title || settings.name
        : title + " | " + settings.name;
    document.title = full;
    function meta(key, value, prop = false) {
      const attr = prop ? "property" : "name";
      let e = document.head.querySelector("meta[" + attr + '="' + key + '"]');
      if (!value) {
        e?.remove();
        return;
      }
      if (!e) {
        e = document.createElement("meta");
        e.setAttribute(attr, key);
        document.head.appendChild(e);
      }
      e.content = value;
    }
    let c = document.head.querySelector('link[rel="canonical"]');
    const origin = c ? new URL(c.href).origin : location.origin;
    const url =
      origin + (pathname === "/" ? "/" : pathname.replace(/\/+$/, "") + "/");
    if (!c) {
      c = document.createElement("link");
      c.rel = "canonical";
      document.head.appendChild(c);
    }
    c.href = url;
    meta("description", description);
    meta("og:title", full, true);
    meta("og:type", type, true);
    meta("og:url", url, true);
    meta("og:description", description, true);
    meta("og:image", image ? origin + image : "", true);
    meta("robots", noindex ? "noindex,nofollow" : "");
    meta("article:published_time", published, true);
    meta("article:author", author, true);
    let schema = document.getElementById("page-schema");
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "page-schema";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": type === "article" ? "Article" : "WebPage",
      name: title,
      description,
      url,
      ...(type === "article"
        ? {
            headline: title,
            datePublished: published,
            publisher: { "@type": "Organization", name: settings.name },
          }
        : {}),
      ...(author ? { author: { "@type": "Person", name: author } } : {}),
      ...(image ? { image: origin + image } : {}),
    });
  }, [
    title,
    description,
    image,
    type,
    noindex,
    pathname,
    published,
    author,
    settings,
  ]);
  return null;
}
export function Action({ to, children, variant = "link", external = false }) {
  const klass = "action " + variant;
  if (external)
    return (
      <a className={klass} href={to}>
        {children}
        <ArrowUpRight size={16} />
      </a>
    );
  return (
    <Link className={klass} to={to}>
      {children}
      {variant === "link" ? (
        <ArrowUpRight size={17} />
      ) : (
        <ArrowRight size={16} />
      )}
    </Link>
  );
}
export function Eyebrow({ children }) {
  return (
    <p className="eyebrow">
      <span aria-hidden="true" />
      {children}
    </p>
  );
}
export function Photo({
  id,
  priority = false,
  caption = false,
  fit = "100vw",
  className = "",
  overrideUrl = "",
  overrideAlt = "",
}) {
  const p = content.photos.find((v) => v.key === id);
  if (!p) return null;
  return (
    <figure className={"photo " + className}>
      <div className="image-window" data-mask>
        <img
          src={overrideUrl || "/images/" + id + "-" + (p.widths?.[1] || 1200) + ".webp"}
          srcSet={overrideUrl ? undefined : (p.widths || [640, 1200, 1920])
            .map((w) => "/images/" + id + "-" + w + ".webp " + w + "w")
            .join(", ")}
          sizes={fit}
          width="1200"
          height="800"
          alt={overrideUrl ? (overrideAlt || p.alt) : p.alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        />
      </div>
      {caption && !overrideUrl && (
        <figcaption>
          <span>{p.location}</span>
          <Link to="/credits/">
            Photography credits <ArrowUpRight size={12} />
          </Link>
        </figcaption>
      )}
    </figure>
  );
}
export function Media({ url, alt = "", className = "" }) {
  return url ? (
    <img
      className={"cms-image " + className}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  ) : null;
}
export function Resource({ value, children }) {
  if (value.error)
    return (
      <div className="notice" role="alert">
        <p>{value.error.message}</p>
        <button type="button" className="text-button" onClick={value.reload}>
          Try again
        </button>
      </div>
    );
  if (!value.data)
    return (
      <p role="status" className="loading">
        Loading…
      </p>
    );
  return children(value.data);
}
export function Crumbs({ items = [] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      {items.map(([name, to], i) => (
        <React.Fragment key={i}>
          <ChevronRight size={13} />
          {to ? (
            <Link to={to}>{name}</Link>
          ) : (
            <span aria-current="page">{name}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
export function Intro({ over, title, desc, crumbs, children, green = false }) {
  return (
    <header className={"page-intro " + (green ? "green" : "")}>
      <div className="wrap">
        {crumbs && <Crumbs items={crumbs} />}{" "}
        {over && <Eyebrow>{over}</Eyebrow>}
        <h1 data-reveal>{title}</h1>
        {desc && <p className="lead">{desc}</p>}
        {children}
      </div>
    </header>
  );
}
export function NotFound() {
  return (
    <div className="wrap not-found">
      <Seo
        title="Page not found"
        noindex
        description="Return to the SRI homepage."
      />
      <Eyebrow>404</Eyebrow>
      <h1>Page not found.</h1>
      <p>
        This address may have changed or the item may no longer be published.
      </p>
      <Action to="/" variant="solid">
        Return home
      </Action>
    </div>
  );
}
export function Empty({ title, body, action, to }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {to && <Action to={to}>{action}</Action>}
    </div>
  );
}
export function SectionTitle({ label, title, children }) {
  return (
    <div className="section-title">
      {label && <Eyebrow>{label}</Eyebrow>}
      <div>
        <h2 data-reveal>{title}</h2>
        {children}
      </div>
    </div>
  );
}

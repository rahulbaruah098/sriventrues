import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X, ChevronDown } from "lucide-react";
import data from "@shared/content.json";
import { useSettings } from "../lib/context";
import { Action } from "./ui";
import { ScrollMotion, Splash } from "./motion";
import AnalyticsPreference from "./analytics";

const groups = [
  [
    "About SRI",
    "/about/",
    [
      ["Company overview", "/about/"],
      ["Know the Founder", "/know-the-founder/"],
      ["Our Approach", "/our-approach/"],
      ["Our Work", "/our-work/"],
      ["Partnerships", "/partnerships/"],
    ],
  ],
  [
    "Ventures",
    "/ventures/",
    [
      ["SRI Ventures overview", "/ventures/"],
      ...data.ventures.map((v) => [v.title, "/ventures/" + v.slug + "/"]),
      ["Product catalogue", "/ventures/products/"],
      ["Ventures partnerships", "/ventures/partnerships/"],
    ],
  ],
  [
    "Consulting",
    "/consulting/",
    [
      ["SRI Consulting overview", "/consulting/"],
      ...data.consulting.map((v) => [v.title, "/consulting/" + v.slug + "/"]),
      ["Engagement models", "/consulting/engagement-models/"],
    ],
  ],
];
export function Brand({ settings, compact = false }) {
  const s = settings;
  if (s.logo)
    return (
      <img
        className="brand-image"
        style={{ width: s.logo_width }}
        src={s.logo}
        alt={s.name}
      />
    );
  if (s.name !== data.settings.name)
    return <span className="brand-full">{s.name}</span>;
  return (
    <span
      className={"wordmark " + (compact ? "compact" : "")}
      aria-label={s.name}
    >
      <b aria-hidden="true">SRI</b>
      <span aria-hidden="true">
        Ventures &amp; Consulting
        <br />
        Pvt. Ltd.
      </span>
    </span>
  );
}
function Navbar() {
  const settings = useSettings(),
    { pathname } = useLocation();
  const [open, setOpen] = useState(null),
    [mobile, setMobile] = useState(false);
  const header = useRef(),
    dialog = useRef(),
    toggle = useRef();
  const close = () => setMobile(false);
  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);
  useEffect(() => {
    function outside(e) {
      if (!header.current?.contains(e.target)) setOpen(null);
    }
    function esc(e) {
      if (e.key === "Escape" && open !== null) {
        header.current
          ?.querySelector('[aria-controls="nav-' + open + '"]')
          ?.focus();
        setOpen(null);
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  useEffect(() => {
    const el = dialog.current;
    if (!mobile) return;
    el.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const media = matchMedia("(min-width: 1080px)");
    const check = () => {
      if (media.matches) close();
    };
    media.addEventListener("change", check);
    return () => {
      el.close();
      document.body.style.overflow = before;
      media.removeEventListener("change", check);
      toggle.current?.focus({ preventScroll: true });
    };
  }, [mobile]);
  return (
    <header className="site-header" ref={header}>
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label={settings.name + " home"}>
          <Brand settings={settings} />
        </Link>
        <nav aria-label="Main" className="desktop-nav">
          {groups.map(([label, base, links], i) => (
            <div
              className="nav-group"
              key={base}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  setOpen((v) => (v === i ? null : v));
              }}
            >
              <button
                className={
                  links.some(
                    ([, l]) => l === pathname || pathname.startsWith(base),
                  )
                    ? "current"
                    : ""
                }
                aria-expanded={open === i}
                aria-controls={"nav-" + i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {label}
                <ChevronDown size={13} />
              </button>
              <div className="dropdown" id={"nav-" + i} hidden={open !== i}>
                {links.map(([l, p]) => (
                  <NavLink end key={p} to={p}>
                    {l}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <NavLink to="/industries/">Industries</NavLink>
          <NavLink to="/insights/">Insights</NavLink>
        </nav>
        <Link to="/contact/" className="nav-contact">
          Contact us <ArrowUpRight size={16} />
        </Link>
        <button
          className="menu-toggle"
          ref={toggle}
          onClick={() => setMobile(true)}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={mobile}
        >
          <Menu />
        </button>
      </div>
      <dialog
        className="mobile-nav"
        ref={dialog}
        aria-label="Site navigation"
        onCancel={close}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="drawer">
          <div className="drawer-top">
            <Brand settings={settings} />
            <button onClick={close} aria-label="Close navigation" autoFocus>
              <X />
            </button>
          </div>
          <nav aria-label="Mobile">
            <Link onClick={close} to="/">
              Home
            </Link>
            {groups.map(([label, base, links]) => (
              <details key={base}>
                <summary>
                  {label}
                  <ChevronDown size={16} />
                </summary>
                {links.map(([l, p]) => (
                  <NavLink onClick={close} end key={p} to={p}>
                    {l}
                  </NavLink>
                ))}
              </details>
            ))}
            {[
              ["Industries", "/industries/"],
              ["Insights", "/insights/"],
              ["Contact us", "/contact/"],
            ].map(([l, p]) => (
              <Link key={p} onClick={close} to={p}>
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </header>
  );
}
function Footer() {
  const s = useSettings();
  const group = (heading, links) => (
    <div>
      <h2>{heading}</h2>
      {links.map(([l, p]) => (
        <Link key={p} to={p}>
          {l}
        </Link>
      ))}
    </div>
  );
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className={s.logo ? "logo-plate" : ""}>
              <Brand settings={s} />
            </Link>
            <p className="footer-tag">{s.tagline}</p>
            <p>
              Connecting products and markets. Strengthening rural enterprises
              and the institutions behind them.
            </p>
          </div>
          {group("SRI Ventures", [
            ["Farm inputs", "/ventures/farm-inputs/"],
            ["Farm outputs", "/ventures/farm-outputs/"],
            ["Handloom", "/ventures/handloom/"],
            ["Product catalogue", "/ventures/products/"],
          ])}
          {group("SRI Consulting", [
            ["Advisory services", "/consulting/"],
            ["Engagement models", "/consulting/engagement-models/"],
            ["Our approach", "/our-approach/"],
            ["Our work", "/our-work/"],
          ])}
          {group("Company", [
            ["About SRI", "/about/"],
            ["Know the Founder", "/know-the-founder/"],
            ["Insights", "/insights/"],
            ["Partnerships", "/partnerships/"],
            ["Contact", "/contact/"],
          ])}
        </div>
        {(s.address ||
          s.phone ||
          s.email ||
          s.socials?.length > 0 ||
          s.whatsapp) && (
          <div className="footer-contact">
            {s.address && <span>{s.address}</span>}
            {s.email && <a href={"mailto:" + s.email}>{s.email}</a>}
            {s.phone && <a href={"tel:" + s.phone}>{s.phone}</a>}
            {s.whatsapp && (
              <a href={"https://wa.me/" + s.whatsapp.replace(/\D/g, "")}>
                WhatsApp
              </a>
            )}
            {s.socials?.map((x) => (
              <a key={x.url} href={x.url}>
                {x.label}
              </a>
            ))}
          </div>
        )}
        <div className="footer-foot">
          <span>
            © {new Date().getFullYear()} {s.name}
          </span>
          <div>
            <Link to="/privacy/">Privacy</Link>
            <Link to="/terms/">Terms</Link>
            <Link to="/credits/">Photography</Link>
            <AnalyticsPreference />
          </div>
        </div>
      </div>
    </footer>
  );
}
export default function PublicLayout() {
  const [opening, setOpening] = useState(
    () =>
      !!window.sriOpeningAt && performance.now() - window.sriOpeningAt < 3450,
  );
  const finish = useCallback(() => {
    document.documentElement.classList.remove("sri-opening");
    window.sriOpeningAt = 0;
    setOpening(false);
  }, []);
  const root = useRef();
  return (
    <>
      {opening && <Splash finish={finish} />}
      <div
        inert={opening || undefined}
        className={opening ? "site intro-pending" : "site intro-ready"}
        ref={root}
      >
        <a href="#main-content" className="skip">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
        <ScrollMotion active={!opening} root={root} />
      </div>
    </>
  );
}
export function Closing() {
  return (
    <section className="closing">
      <div className="wrap">
        <h2 data-reveal>Let’s build opportunities together.</h2>
        <div className="actions">
          <Action to="/ventures/products/" variant="light">
            Explore products
          </Action>
          <Action to="/contact/?type=consulting" variant="outline-light">
            Request consulting
          </Action>
          <Action to="/partnerships/" variant="light-link">
            Become a partner
          </Action>
        </div>
      </div>
    </section>
  );
}

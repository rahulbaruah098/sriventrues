import SriAssistantVisibility from "./SriAssistantVisibility";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X, ChevronDown, ArrowUp, MapPin, Phone, Mail, MessageCircle, Send, Linkedin, Instagram, Facebook, Youtube, ExternalLink } from "lucide-react";
import data from "@shared/content.json";
import { useSettings } from "../lib/context";
import { Action } from "./ui";
import { ScrollMotion, Splash } from "./motion";
import AnalyticsPreference from "./analytics";
import SriAssistant from "./SriAssistant";
import { api } from "../lib/api";
import "../styles/footer-redesign.css";

const groups = [
  [
    "About SRI",
    "/about/",
    [
      ["Company overview", "/about/"],
      ["Know the Founder", "/know-the-founder/"],
      ["Meet the Team", "/meet-the-team/"],
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
  const settings = useSettings();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(null);
  const [mobile, setMobile] = useState(false);
  const header = useRef(null);
  const dialog = useRef(null);
  const toggle = useRef(null);
  const close = () => setMobile(false);
  const pageLabel = (() => {
    if (pathname === "/") return "Home";
    if (pathname.startsWith("/industries")) return "Our Industries";
    if (pathname.startsWith("/insights")) return "Insights";
    if (pathname.startsWith("/blogs")) return "Blogs";
    if (pathname.startsWith("/meet-the-team")) return "Meet the Team";
    if (pathname.startsWith("/know-our-consultants")) return "Know Our Consultants";
    if (pathname.startsWith("/know-the-founder")) return "Know the Founder";
    if (pathname.startsWith("/our-work")) return "Our Work";
    if (pathname.startsWith("/our-approach")) return "Our Approach";
    if (pathname.startsWith("/ventures")) return "SRI Ventures";
    if (pathname.startsWith("/consulting")) return "SRI Consulting";
    if (pathname.startsWith("/contact")) return "Contact Us";
    if (pathname.startsWith("/partnerships")) return "Partnerships";
    if (pathname.startsWith("/about")) return "About SRI";
    return "SRI Ventures";
  })();

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    function outside(event) {
      if (!header.current?.contains(event.target)) setOpen(null);
    }
    function onEscape(event) {
      if (event.key === "Escape" && open !== null) {
        header.current?.querySelector('[aria-controls="nav-' + open + '"]')?.focus();
        setOpen(null);
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    const el = dialog.current;
    if (!mobile || !el) return;
    if (!el.open) el.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const media = matchMedia("(min-width: 1080px)");
    const onResize = () => { if (media.matches) close(); };
    media.addEventListener("change", onResize);
    return () => {
      if (el.open) el.close();
      document.body.style.overflow = previousOverflow;
      media.removeEventListener("change", onResize);
      toggle.current?.focus({ preventScroll: true });
    };
  }, [mobile]);

  return (
    <header className="site-header sri-premium-header" ref={header}>
      <div className="nav-inner sri-premium-navbar">
        <Link to="/" className="brand" aria-label={settings.name + " home"}>
          <Brand settings={settings} />
        </Link>
        <span className="sri-mobile-page" aria-label={pageLabel}>
          <small>{pageLabel === "Home" ? "WELCOME" : "EXPLORE SRI"}</small>
          <strong>{pageLabel}</strong>
        </span>
        <nav aria-label="Main" className="desktop-nav">
          {groups.map(([label, base, links], i) => (
            <div
              className="nav-group sri-hover-group"
              key={base}
              onMouseEnter={() => setOpen(i)}
              onMouseLeave={() => setOpen((v) => v === i ? null : v)}
              onFocus={() => setOpen(i)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  setOpen((v) => v === i ? null : v);
              }}
            >
              <button
                type="button"
                className={links.some(([, l]) => l === pathname || pathname.startsWith(base)) ? "current" : ""}
                aria-haspopup="true"
                aria-expanded={open === i}
                aria-controls={"nav-" + i}
                onClick={() => setOpen((v) => v === i ? null : i)}
              >
                {label}
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              <div className="dropdown" id={"nav-" + i} hidden={open !== i}>
                {links.map(([l, p]) => (
                  <NavLink end key={p} to={p}>{l}</NavLink>
                ))}
              </div>
            </div>
          ))}
          <NavLink to="/industries/">Industries</NavLink>
          <NavLink to="/insights/">Insights</NavLink>
          <NavLink to="/careers/">Careers</NavLink>
          <NavLink to="/know-our-consultants/">Know Our Consultants</NavLink>
          <NavLink to="/blogs/">Blogs</NavLink>
        </nav>
        <Link to="/contact/" className="nav-contact sri-contact-cta">
          Contact us <ArrowUpRight size={17} />
        </Link>
        <button
          type="button"
          className={"menu-toggle sri-hamburger" + (mobile ? " is-open" : "")}
          ref={toggle}
          onClick={() => setMobile((value) => !value)}
          aria-label={mobile ? "Close navigation" : "Open navigation"}
          aria-haspopup="dialog"
          aria-controls="sri-mobile-navigation"
          aria-expanded={mobile}
        >
          <span className="sri-hamburger-lines" aria-hidden="true">
            <i /><i /><i />
          </span>
        </button>
      </div>
      <dialog
        id="sri-mobile-navigation"
        className="mobile-nav sri-mobile-drawer sri-v8-modal"
        ref={dialog}
        aria-label="Site navigation"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClose={close}
        onClick={(event) => { if (event.target === dialog.current) close(); }}
      >
        <div className="drawer sri-v8-drawer">
          <div className="drawer-top sri-v8-drawer-top">
            <Link to="/" onClick={close} aria-label={settings.name + " home"}>
              <Brand settings={settings} />
            </Link>
            <button type="button" className="sri-hamburger sri-v8-close is-open" onClick={(event) => { event.stopPropagation(); close(); }} aria-label="Close navigation" autoFocus>
              <span className="sri-hamburger-lines" aria-hidden="true"><i /><i /><i /></span>
            </button>
          </div>
          <div className="sri-v8-drawer-body">
            <p className="sri-v8-kicker">EXPLORE SRI</p>
            <nav aria-label="Mobile">
            <Link onClick={close} to="/" className={pathname === "/" ? "sri-v8-active" : ""}>Home</Link>
            {groups.map(([label, base, links]) => (
              <details key={base}>
                <summary>{label}<ChevronDown size={17} aria-hidden="true" /></summary>
                {links.map(([l, p]) => (
                  <NavLink onClick={close} end key={p} to={p}>{l}</NavLink>
                ))}
              </details>
            ))}
            <Link onClick={close} to="/industries/">Industries</Link>
            <Link onClick={close} to="/insights/">Insights</Link>
            <Link onClick={close} to="/know-our-consultants/">Know Our Consultants</Link>
            <Link onClick={close} to="/blogs/">Blogs</Link>
            <Link onClick={close} to="/contact/" className="sri-drawer-contact">
              Contact us <ArrowUpRight size={18} />
            </Link>
            <Link onClick={close} to="/careers/">Careers</Link>
          </nav>
            <div className="sri-v8-drawer-bottom">
              <span>Driving Sustainable Rural Innovations</span>
              <span>SRI Ventures &amp; Consulting Pvt. Ltd.</span>
            </div>
          </div>
        </div>
      </dialog>
    </header>
  );
}

function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("public/newsletter", {
        method: "POST",
        data: { email, consent },
      });
      setEmail("");
      setConsent(false);
      setMessage("If confirmation is needed, a link will arrive by email.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sri-footer-newsletter">
      <h3>Subscribe to our newsletter</h3>
      <p>Stay updated with our projects, insights and opportunities.</p>
      <form onSubmit={handleSubmit}>
        <label className="sri-footer-email-label" htmlFor="sri-footer-email">
          Email address
        </label>
        <div className="sri-footer-email-row">
          <input
            id="sri-footer-email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" aria-label="Subscribe to SRI newsletter" disabled={busy}>
            <Send size={20} aria-hidden="true" />
          </button>
        </div>
        <label className="sri-footer-consent">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          I agree to receive SRI's published insights.
        </label>
        <p className="sri-footer-form-status" role="status" aria-live="polite">
          {message}
        </p>
      </form>
    </div>
  );
}

function Footer() {
  const s = useSettings();
  const companyLinks = [
    ["Careers", "/careers/"],
    ["About SRI", "/about/"],
    ["Know the Founder", "/know-the-founder/"],
    ["Our Approach", "/our-approach/"],
    ["Our Work", "/our-work/"],
    ["Insights", "/insights/"],
    ["Partnerships", "/partnerships/"],
  ];
  const venturesLinks = [
    ["Farm inputs", "/ventures/farm-inputs/"],
    ["Farm outputs", "/ventures/farm-outputs/"],
    ["Handloom", "/ventures/handloom/"],
    ["Product catalogue", "/ventures/products/"],
  ];
  const consultingLinks = [
    ["Advisory services", "/consulting/"],
    ["Engagement models", "/consulting/engagement-models/"],
    ["Our approach", "/our-approach/"],
    ["Our work", "/our-work/"],
  ];
  const linkGroup = (heading, links) => (
    <div className="sri-footer-link-col" key={heading}>
      <h2>{heading}</h2>
      <div className="sri-footer-heading-rule" aria-hidden="true" />
      <ul>
        {links.map(([label, url]) => (
          <li key={url}>
            <Link to={url}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="site-footer sri-mega-footer">
      <div className="sri-footer-wave" aria-hidden="true">
        <img src="/images/sri-footer-reference-wave.webp" alt="" loading="eager" decoding="async" />
      </div>
      <div className="sri-footer-landscape" aria-hidden="true" />
      <div className="sri-footer-contours" aria-hidden="true" />
      <div className="wrap sri-footer-inner">
        <div className="sri-footer-grid">
          <div className="sri-footer-identity">
            <Link to="/" className={s.logo ? "logo-plate" : ""} aria-label={s.name + " home"}>
              <Brand settings={s} />
            </Link>
            <p className="sri-footer-tagline">{s.tagline}</p>
            <p className="sri-footer-description">
              Connecting products and markets. Strengthening rural enterprises
              and the institutions behind them.
            </p>
            {s.socials?.length > 0 && (
              <div className="sri-footer-socials" aria-label="SRI social media">
                {s.socials.map((social) => {
                  const name = (social.label || "").toLowerCase();
                  const Icon = name.includes("linkedin") ? Linkedin :
                    name.includes("instagram") ? Instagram :
                    name.includes("facebook") ? Facebook :
                    name.includes("youtube") ? Youtube : ExternalLink;
                  return (
                    <a key={social.url} href={social.url} target="_blank" rel="noopener noreferrer" aria-label={social.label || "External social link"} title={social.label}>
                      <Icon size={18} aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          {linkGroup("Company", companyLinks)}
          {linkGroup("SRI Ventures", venturesLinks)}
          {linkGroup("SRI Consulting", consultingLinks)}
          <div className="sri-footer-contact-col">
            <h2>Get in Touch</h2>
            {(s.address || s.phone || s.email || s.whatsapp) && (
              <ul className="sri-footer-contact-list">
                {s.address && <li><MapPin size={18} aria-hidden="true" /><span>{s.address}</span></li>}
                {s.phone && <li><Phone size={18} aria-hidden="true" /><a href={"tel:" + s.phone}>{s.phone}</a></li>}
                {s.email && <li><Mail size={18} aria-hidden="true" /><a href={"mailto:" + s.email}>{s.email}</a></li>}
                {s.whatsapp && <li><MessageCircle size={18} aria-hidden="true" /><a href={"https://wa.me/" + s.whatsapp.replace(/\D/g, "")} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
              </ul>
            )}
            <Link className="sri-footer-contact-cta" to="/contact/">
              Contact SRI <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            {s.newsletter ? (
              <FooterNewsletter />
            ) : (
              <div className="sri-footer-newsletter-disabled">
                <h3>Explore our Insights</h3>
                <p>Perspectives, projects and updates from SRI.</p>
                <Link to="/insights/">Explore Insights <ArrowUpRight size={17} /></Link>
              </div>
            )}
          </div>
        </div>
        <button
          className="sri-footer-to-top"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={22} aria-hidden="true" />
        </button>
        <div className="sri-footer-legal">
          <div className="sri-footer-attribution">
            <span>© {new Date().getFullYear()} {s.name}. All rights reserved.</span>
            <span>Developed by <a href="https://www.techeaseconsulting.com/" target="_blank" rel="noopener noreferrer">TechEase Consulting</a></span>
            <span>Built in Assam with <span role="img" aria-label="love">❤️</span></span>
          </div>
          <nav aria-label="Legal information">
            <Link to="/privacy/">Privacy</Link>
            <Link to="/terms/">Terms</Link>
            <Link to="/credits/">Photography</Link>
            <AnalyticsPreference />
          </nav>
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
        className={opening ? "site intro-pending" : "site intro-ready"}        ref={root}
      >
        <a href="#main-content" className="skip">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
        {!opening && <SriAssistantVisibility><SriAssistant /></SriAssistantVisibility>}
        <ScrollMotion active={!opening} root={root} />      </div>
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

import React, { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ArrowUpRight, Menu, LogOut, X } from "lucide-react";
import { api, useData, setToken } from "../lib/api";
import { useSettings } from "../lib/context";
import { Brand } from "../components/layout";
import { Resource, Seo } from "../components/ui";
import { AdminTitle, Feedback, Field, useSave } from "./controls";
import { dateLabel } from "../lib/api";

const navigation = [
  ["Website Favicon", "favicon"],
  ["Job Postings", "careers/jobs"],
  ["Applications & Resumes", "careers/applications"],
  ["Recruitment Emails", "careers/emails"],
  ["Email Templates", "careers/templates"],
  ["Careers SMTP", "careers/smtp"],
  ["Trusted Clients", "clients"],
  ["Our Partners", "partners"],
  ["Testimonials", "testimonials"],
  ["Dashboard", ""],
  ["Insights & Articles", "articles"],
  ["Blogs", "blogs"],
  ["Know Our Consultants", "consultants"],
  ["Meet the Team", "team"],
  ["Our Approach", "approach"],
  ["Our Work / Case Studies", "case-studies"],
  ["Product Catalogue", "products"],
  ["Know the Founder", "founder"],
  ["Enquiries", "enquiries"],
  ["Company Branding", "branding"],
  ["Website Settings", "settings"],
  ["Admin Account", "account"],
];
export function Login() {
  const navigate = useNavigate(),
    where = useLocation(),
    s = useSettings(),
    state = useSave();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const dest = where.state?.from;
  const target =
    typeof dest === "string" &&
    /^\/admin(?:\/|$)/.test(dest) &&
    !dest.startsWith("/admin/login")
      ? dest
      : "/admin";
  const session = useData("auth/session");
  if (session.data) return <Navigate to={target} replace />;
  return (
    <main className="login">
      <Seo
        title="Staff sign in"
        noindex
        description="SRI website administration"
      />
      <div>
        <Link to="/" className="brand">
          <Brand settings={s} />
        </Link>
        <h1>Staff sign in</h1>
        <p>Manage the SRI website and respond to enquiries.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            state.run(async () => {
              await api("auth/login", {
                method: "POST",
                data: { email, password },
              });
              navigate(target, { replace: true });
            }, "");
          }}
        >
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
          <Feedback {...state} />
          <button className="button" disabled={state.busy}>
            {state.busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link to="/">Return to website</Link>
      </div>
    </main>
  );
}
export default function AdminLayout() {
  const session = useData("auth/session"),
    where = useLocation(),
    navigate = useNavigate(),
    s = useSettings(),
    state = useSave();
  const [menu, showMenu] = useState(false);
  useEffect(() => {
    showMenu(false);
    window.scrollTo(0, 0);
  }, [where.pathname]);
  useEffect(() => {
    const expired = () =>
      navigate("/admin/login", {
        replace: true,
        state: { from: where.pathname },
      });
    window.addEventListener("sri:session-expired", expired);
    return () => window.removeEventListener("sri:session-expired", expired);
  }, [navigate, where.pathname]);
  if (session.error?.status === 401)
    return (
      <Navigate to="/admin/login" replace state={{ from: where.pathname }} />
    );
  return (
    <Resource value={session}>
      {(user) => (
        <div className="admin-shell">
          <Seo
            title="Staff administration"
            noindex
            description="SRI website administration"
          />
          <aside className="admin-sidebar">
            <div className="admin-logo">
              <Brand settings={s} />
              <button
                type="button"
                className="admin-menu"
                aria-expanded={menu}
                aria-controls="staff-nav"
                aria-label="Toggle staff navigation"
                onClick={() => showMenu(!menu)}
              >
                {menu ? <X /> : <Menu />}
              </button>
            </div>
            <nav
              id="staff-nav"
              className={menu ? "opened" : ""}
              aria-label="Staff navigation"
            >
              {navigation.map(([l, p]) => (
                <NavLink key={l} end={!p} to={p ? "/admin/" + p : "/admin"}>
                  {l}
                </NavLink>
              ))}
              <Link to="/">
                View public website <ArrowUpRight size={14} />
              </Link>
            </nav>
          </aside>
          <div className="admin-main">
            <div className="admin-bar">
              <span>{user.email}</span>
              <button
                className="text-button"
                disabled={state.busy}
                onClick={() =>
                  state.run(async () => {
                    await api("auth/logout", { method: "POST", data: {} });
                    setToken("");
                    navigate("/admin/login", { replace: true });
                  }, "")
                }
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
            <Feedback {...state} />
            <main className="admin-content" id="main-content">
              <Outlet context={{ user, refreshSession: session.reload }} />
            </main>
          </div>
        </div>
      )}
    </Resource>
  );
}
export function Dashboard() {
  const r = useData("admin/dashboard");
  return (
    <>
      <AdminTitle
        title="Dashboard"
        description="Publication activity and incoming enquiries."
      />
      <Resource value={r}>
        {(d) => (
          <>
            <div className="metrics">
              {[
                [
                  "Published articles",
                  "published_articles",
                  "articles?status=published",
                ],
                ["Draft articles", "draft_articles", "articles?status=draft"],
                [
                  "Published cases",
                  "published_cases",
                  "case-studies?status=published",
                ],
                ["All enquiries", "enquiries", "enquiries"],
                ["New enquiries", "new_enquiries", "enquiries?status=New"],
              ].map(([l, k, u]) => (
                <Link key={k} to={"/admin/" + u}>
                  <span>{l}</span>
                  <b>{d.counts[k]}</b>
                </Link>
              ))}
            </div>
            <div className="admin-columns">
              <section>
                <h2>Recent enquiries</h2>
                {d.recent.length ? (
                  d.recent.map((e) => (
                    <Link
                      className="record-link"
                      key={e.id}
                      to={"/admin/enquiries/" + e.id}
                    >
                      <b>{e.data.name}</b>
                      <span>
                        {e.reference} · {e.type}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p>New submissions will appear here.</p>
                )}
              </section>
              <section>
                <h2>Recent content updates</h2>
                {d.updates.map((e) => (
                  <Link
                    className="record-link"
                    key={e.kind + e.id}
                    to={
                      "/admin/" +
                      e.kind +
                      (["founder", "approach"].includes(e.kind)
                        ? ""
                        : "/" + e.id)
                    }
                  >
                    <b>{e.title}</b>
                    <span>{dateLabel(e.updated_at, true)}</span>
                  </Link>
                ))}
              </section>
            </div>
          </>
        )}
      </Resource>
    </>
  );
}

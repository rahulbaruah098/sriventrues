import "./styles/sri-assistant-v26.css";
import './lib/favicon.js';
import React, { lazy, Suspense, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { BrandingProvider } from "./lib/context";
import PublicLayout from "./components/layout";
import { NotFound } from "./components/ui";
import "./styles/site.css";
import "./styles/careers.css";
import "./styles/admin.css";

const pick = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));
const corporate = () => import("./public/Corporate");
const Home = lazy(() => import("./public/Home"));
const Gallery = lazy(() => import("./public/Gallery"));
const GalleryAdmin = lazy(() => import("./admin/GalleryAdmin"));
const IndustryImagesAdmin = lazy(() => import("./admin/IndustryImagesAdmin"));
const About = pick(corporate, "About"),
  Vertical = pick(corporate, "Vertical"),
  Service = pick(corporate, "Service"),
  Engagement = pick(corporate, "Engagement"),
  Industries = pick(corporate, "Industries"),
  Industry = pick(corporate, "Industry"),
  Partnerships = pick(corporate, "Partnerships"),
  Approach = pick(corporate, "Approach"),
  Founder = pick(corporate, "Founder"),
  Information = pick(corporate, "Information");
const collection = () => import("./public/Collections");
const Collection = pick(collection, "Collection"),
  Detail = pick(collection, "Detail"),
  Contact = lazy(() => import("./public/Contact"));
const Newsletter = lazy(() => import("./public/Newsletter"));
const admin = () => import("./admin/Layout");
const AdminLayout = lazy(admin),
  Login = pick(admin, "Login"),
  Dashboard = pick(admin, "Dashboard");
const editors = () => import("./admin/Content");
const ContentList = pick(editors, "ContentList"),
  ContentEditor = pick(editors, "ContentEditor");
const PageEditor = pick(() => import("./admin/Pages"), "PageEditor"),
  Settings = pick(() => import("./admin/Settings"), "SettingsEditor"),
  Account = pick(() => import("./admin/Settings"), "Account"),
  Inbox = pick(() => import("./admin/Enquiries"), "Inbox"),
  Enquiry = pick(() => import("./admin/Enquiries"), "EnquiryDetail");

const directoryPublic = () => import('./public/DirectoryPages');
const DirectoryPage = pick(directoryPublic, 'DirectoryPage'),
  DirectoryDetail = pick(directoryPublic, 'DirectoryDetail');
const relationshipsAdmin = () => import('./admin/RelationshipsAdmin');
const RelationshipsList = pick(relationshipsAdmin, 'RelationshipsList'),
  RelationshipsEditor = pick(relationshipsAdmin, 'RelationshipsEditor');
const directoryAdmin = () => import('./admin/DirectoryAdmin');
const DirectoryAdminList = pick(directoryAdmin, 'DirectoryAdminList'),
  DirectoryAdminEditor = pick(directoryAdmin, 'DirectoryAdminEditor');
const careers = () => import('./public/Careers');
const Careers = pick(careers, 'Careers'), CareerDetail = pick(careers, 'CareerDetail');
const careersAdmin = () => import('./admin/CareersAdmin');
const CareerJobs = pick(careersAdmin,'CareerJobs'), CareerJobEditor=pick(careersAdmin,'CareerJobEditor'),
  CareerApplications=pick(careersAdmin,'CareerApplications'), CareerApplicant=pick(careersAdmin,'CareerApplicant'),
  CareerSMTP=pick(careersAdmin,'CareerSMTP'), CareerEmailHistory=pick(careersAdmin,'CareerEmailHistory'),
  CareerTemplates=pick(careersAdmin,'CareerTemplates');

const faviconAdmin = () => import('./admin/FaviconManager');
const FaviconManager = pick(faviconAdmin, 'FaviconManager');

function RouteScroll() {
  const { pathname, hash } = useLocation(),
    type = useNavigationType(),
    previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (type === "POP" || hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname, type, hash]);
  return null;
}
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="wrap band">
        <h1>Page unavailable.</h1>
        <p>Reload the page to try again.</p>
        <button className="button" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <BrandingProvider>
          <RouteScroll />
          <Suspense
            fallback={
              <div className="route-loading" role="status">
                Loading page…
              </div>
            }
          >
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                {[
                  ['meet-the-team', 'team'],
                  ['know-our-consultants', 'consultants'],
                  ['blogs', 'blogs']
                ].map(([path, kind]) => <React.Fragment key={path}>
                  <Route path={path} element={<DirectoryPage kind={kind} />}/>
                  <Route path={path + '/:slug'} element={<DirectoryDetail kind={kind} />}/>
                </React.Fragment>)}
                <Route path="about" element={<About />} />
                <Route path="about/gallery" element={<Gallery />} />
                <Route path="know-the-founder" element={<Founder />} />
                <Route
                  path="about/know-the-founder"
                  element={<Navigate replace to="/know-the-founder/" />}
                />
                <Route path="ventures" element={<Vertical kind="ventures" />} />
                <Route
                  path="consulting"
                  element={<Vertical kind="consulting" />}
                />
                <Route
                  path="ventures/partnerships"
                  element={<Partnerships ventures />}
                />
                <Route path="partnerships" element={<Partnerships />} />
                <Route
                  path="consulting/engagement-models"
                  element={<Engagement />}
                />
                <Route
                  path="ventures/:slug"
                  element={<Service kind="ventures" />}
                />
                <Route
                  path="consulting/:slug"
                  element={<Service kind="consulting" />}
                />
                <Route path="industries" element={<Industries />} />
                <Route path="industries/:slug" element={<Industry />} />
                <Route path="our-approach" element={<Approach />} />
                <Route path="careers" element={<Careers />} />
                <Route path="careers/:id" element={<CareerDetail />} />
                <Route path="contact" element={<Contact />} />
                <Route path="newsletter" element={<Newsletter />} />
                {Object.entries({
                  insights: "articles",
                  "our-work": "case-studies",
                  "ventures/products": "products",
                }).map(([path, kind]) => (
                  <React.Fragment key={kind}>
                    <Route
                      path={path}
                      element={<Collection key={kind} kind={kind} />}
                    />
                    <Route
                      path={path + "/:slug"}
                      element={<Detail key={kind} kind={kind} />}
                    />
                  </React.Fragment>
                ))}
                {["privacy", "terms", "credits"].map((kind) => (
                  <Route
                    key={kind}
                    path={kind}
                    element={<Information kind={kind} />}
                  />
                ))}
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="admin/login" element={<Login />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="gallery" element={<GalleryAdmin />} />
                <Route path="industry-images" element={<IndustryImagesAdmin />} />
                {['clients', 'partners', 'testimonials'].map(kind => <React.Fragment key={kind}>
                  <Route path={kind} element={<RelationshipsList kind={kind} />}/>
                  <Route path={kind + '/:id'} element={<RelationshipsEditor kind={kind} />}/>
                </React.Fragment>)}
                {['team', 'consultants', 'blogs'].map(kind => <React.Fragment key={kind}>
                  <Route path={kind} element={<DirectoryAdminList kind={kind} />}/>
                  <Route path={kind + '/:id'} element={<DirectoryAdminEditor kind={kind} />}/>
                </React.Fragment>)}
                {["articles", "case-studies", "products"].map((kind) => (
                  <React.Fragment key={kind}>
                    <Route
                      path={kind}
                      element={<ContentList key={kind} kind={kind} />}
                    />
                    <Route
                      path={kind + "/:id"}
                      element={<ContentEditor key={kind} kind={kind} />}
                    />
                  </React.Fragment>
                ))}
                {["founder", "approach"].map((kind) => (
                  <Route
                    key={kind}
                    path={kind}
                    element={<PageEditor key={kind} kind={kind} />}
                  />
                ))}
                <Route path="careers/jobs" element={<CareerJobs />} />
                <Route path="careers/jobs/:id" element={<CareerJobEditor />} />
                <Route path="careers/applications" element={<CareerApplications />} />
                <Route path="careers/applications/:id" element={<CareerApplicant />} />
                <Route path="careers/templates" element={<CareerTemplates />} />
                <Route path="careers/smtp" element={<CareerSMTP />} />
                <Route path="careers/emails" element={<CareerEmailHistory />} />
                <Route path="favicon" element={<FaviconManager />} />
                <Route path="branding" element={<Settings branding />} />
                <Route path="settings" element={<Settings />} />
                <Route path="account" element={<Account />} />
                <Route path="enquiries" element={<Inbox />} />
                <Route path="enquiries/:id" element={<Enquiry />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrandingProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")).render(<App />);

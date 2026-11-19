import "../styles/sri-company-industries-v21.css";
import AboutPitchdeckSections from "./AboutPitchdeckSections";
import { orderedIndustries } from "../lib/industryOrder";
import React from "react";
import '../styles/sri-values-v22.css';
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import data from "@shared/content.json";
import {
  Action,
  Crumbs,
  Empty,
  Eyebrow,
  Intro,
  Media,
  NotFound,
  Photo,
  Resource,
  Seo,
} from "../components/ui";
import { Closing } from "../components/layout";
import { useData, contactLink } from "../lib/api";
import { useSettings } from "../lib/context";
import { StageList } from "./Home";

export function SimpleLinks({ links }) {
  return (
    <div className="simple-links">
      {links.map(([n, u]) => (
        <Link key={u} to={u}>
          {n}
          <ArrowUpRight size={18} />
        </Link>
      ))}
    </div>
  );
}
function Header({ path, over, title, green, children }) {
  const p = data.pages[path];
  return (
    <>
      <Seo title={p.title} description={p.description} />
      <Intro
        over={over}
        title={title || p.title}
        desc={p.description}
        green={green}
        crumbs={[[p.title]]}
      >
        {children}
      </Intro>
    </>
  );
}
export function About() {
  const settings = useSettings();
  return (
    <>
      <Header
        path="/about/"
        over="About SRI"
        title="Building sustainable businesses. Strengthening institutions."
      />
      <section className="wrap band split">
        <Photo
          id="producer"
          caption
          className="portrait-photo"
          fit="(max-width: 740px) 90vw, 38vw"
        />
        <div className="prose">
          <Eyebrow>Corporate philosophy</Eyebrow>
          <h2>People, systems and markets.</h2>
          <p>
            We believe sustainable growth requires more than business expansion.
            It requires strong institutions, capable people, efficient systems,
            responsible leadership and meaningful market connections.
          </p>
          <p>
            SRI Ventures connects farm inputs, farm produce and handloom with
            individual and institutional buyers. SRI Consulting provides
            strategy, business development and institutional strengthening for
            entrepreneurs and organisations.
          </p>
          <div className="actions">
            <Action to="/know-the-founder/">Know the Founder</Action>
            {settings.profile_file && (
              <Action to={settings.profile_file} external>
                Download corporate profile
              </Action>
            )}
          </div>
        </div>
      </section>
      <section className="soft-band band">
        <div className="wrap dual-text">
          <div>
            <Eyebrow>Vision</Eyebrow>
            <h2>Our vision.</h2>
            <p className="lead">
              To become a leading enterprise development organisation promoting
              sustainable innovation, professional excellence and inclusive
              economic growth.
            </p>
          </div>
          <div>
            <Eyebrow>Mission</Eyebrow>
            <h2>Our mission.</h2>
            <p className="lead">
              To create value through quality products, professional consulting,
              innovative business solutions and sustainable enterprise
              development.
            </p>
          </div>
        </div>
      </section>
      <section className="sri-values-v22 wrap band" aria-labelledby="sri-values-title">
        <div className="sri-values-v22__header">
          <span className="sri-values-v22__eyebrow">The principles behind our work</span>
          <h2 id="sri-values-title" data-reveal>Our values.</h2>
          <p>Six commitments that guide how we build enterprises, strengthen institutions and work with communities.</p>
        </div>
        <div className="sri-values-v22__grid">
          {data.values.map(([v, d], index) => (
            <article className="sri-values-v22__card" key={v}>
              <span className="sri-values-v22__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{v}</h3>
                <p>{d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      {/* SRI_V21_ABOUT_COMPANY */}
      <AboutPitchdeckSections />
      <Closing />
    </>
  );
}
export function Vertical({ kind }) {
  const settings = useSettings();
  const venture = kind === "ventures",
    path = "/" + kind + "/",
    items = venture ? data.ventures : data.consulting;
  return (
    <>
      <Header
        path={path}
        over={
          venture
            ? "SRI Ventures · Commercial business"
            : "SRI Consulting · Professional services"
        }
        green={!venture}
        title={
          venture
            ? "Connecting inputs, outputs and markets."
            : "Building businesses. Strengthening institutions."
        }
      >
        <div className="actions">
          <Action
            to={
              venture ? "/ventures/products/" : "/consulting/engagement-models/"
            }
            variant="solid"
          >
            {venture ? "Browse the catalogue" : "Explore engagement models"}
          </Action>
          <Action to={contactLink(kind)}>Make an enquiry</Action>
          {!venture && (
            <Action
              to={contactLink("consulting", {
                service: "Consulting appointment",
              })}
            >
              Request an appointment
            </Action>
          )}
          {!venture && settings.profile_file && (
            <Action to={settings.profile_file} external>
              Corporate profile PDF
            </Action>
          )}
        </div>
      </Header>
      <section className="wrap band">
        <div className="overview-image">
          <Photo id={venture ? "majuli" : "planting"} caption />
        </div>
        <div className="split band">
          <div>
            <Eyebrow>
              {venture ? "Product streams" : "Professional advisory"}
            </Eyebrow>
            <h2 data-reveal>{venture ? "Our catalogue." : "Our services."}</h2>
          </div>
          <div className="editorial-index">
            {items.map((i) => (
              <Link key={i.slug} to={path + i.slug + "/"}>
                <div>
                  <h3>{i.title}</h3>
                  <p>{i.headline}</p>
                </div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </div>
        <div className="bridge">
          <div>
            <h3>
              {venture ? "Grow with SRI Ventures." : "Project or retainer?"}
            </h3>
            <p>
              {venture
                ? "Explore sourcing, distribution, dealership and institutional procurement opportunities."
                : "Choose a defined assignment or ongoing professional advisory support."}
            </p>
          </div>
          <Action
            to={
              venture
                ? "/ventures/partnerships/"
                : "/consulting/engagement-models/"
            }
          >
            {venture ? "Ventures partnerships" : "Compare engagement models"}
          </Action>
        </div>
      </section>
    </>
  );
}
export function Service({ kind }) {
  const { slug } = useParams(),
    item = data[kind].find((x) => x.slug === slug);
  if (!item) return <NotFound />;
  const venture = kind === "ventures",
    root = "/" + kind + "/",
    label = venture ? "SRI Ventures" : "SRI Consulting";
  const index = data[kind].indexOf(item),
    next = data[kind][(index + 1) % data[kind].length];
  const query = venture ? { category: item.title } : { service: item.title };
  return (
    <>
      <Seo title={item.title} description={item.description} />
      <section className={"service-head " + (!venture ? "green" : "")}>
        <div className="wrap">
          <Crumbs items={[[label, root], [item.title]]} />
          <div className="service-grid">
            <div>
              <Eyebrow>{item.title}</Eyebrow>
              <h1 data-reveal>{item.headline}</h1>
              <p className="lead">{item.description}</p>
              <Action to={contactLink(kind, query)} variant="solid">
                {venture
                  ? "Enquire about " + item.title.toLowerCase()
                  : "Discuss your requirements"}
              </Action>
            </div>
            <Photo
              id={item.image}
              caption
              fit="(max-width: 780px) 92vw, 38vw"
            />
          </div>
        </div>
      </section>
      <section className="wrap band split">
        <div>
          <Eyebrow>{label}</Eyebrow>
          <h2>{venture ? "Product focus." : "Scope of advisory."}</h2>
        </div>
        <ul className="scope-list">
          {item.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <section className="soft-band band">
        <div className="wrap split">
          <div>
            <h2>{venture ? "Buying & sourcing." : "Working with SRI."}</h2>
            <p>
              {venture
                ? "Tell us about the product, quantity and delivery location."
                : "Discuss a defined assignment or agree a retainer for ongoing support."}
            </p>
          </div>
          <SimpleLinks
            links={
              venture
                ? [
                    [
                      "Browse this category",
                      "/ventures/products/?category=" +
                        encodeURIComponent(item.title),
                    ],
                    [
                      "Request a quote",
                      contactLink(kind, {
                        ...query,
                        intent: "Request a quote",
                      }),
                    ],
                    [
                      "Bulk enquiry",
                      contactLink(kind, {
                        ...query,
                        buyer: "B2B",
                        intent: "Bulk enquiry",
                      }),
                    ],
                    [
                      "Retail enquiry",
                      contactLink(kind, { ...query, buyer: "B2C" }),
                    ],
                    [
                      slug === "handloom"
                        ? "Handloom partnership"
                        : slug === "farm-outputs"
                          ? "Become a supplier"
                          : "Become a distributor",
                      contactLink("partnerships", {
                        partnership:
                          slug === "handloom"
                            ? "Handloom weaver / producer group"
                            : slug === "farm-outputs"
                              ? "Farm produce supplier / aggregator"
                              : "Distributor",
                      }),
                    ],
                  ]
                : [
                    [
                      "Project-based consulting",
                      contactLink(kind, {
                        ...query,
                        engagement: "Project-based",
                      }),
                    ],
                    [
                      "Retainer-based consulting",
                      contactLink(kind, {
                        ...query,
                        engagement: "Retainer-based",
                      }),
                    ],
                    [
                      "Explore engagement models",
                      "/consulting/engagement-models/",
                    ],
                  ]
            }
          />
        </div>
      </section>
      <div className="wrap band next-page">
        <Eyebrow>Continue exploring</Eyebrow>
        <Action to={root + next.slug + "/"}>{next.title}</Action>
      </div>
    </>
  );
}
export function Engagement() {
  return (
    <>
      <Header
        path="/consulting/engagement-models/"
        over="SRI Consulting"
        green
      />
      <div className="wrap band dual-text">
        {[
          [
            "Project-based",
            "A defined assignment",
            "Agree the scope, deliverables, milestones and timelines for a specific project. This model suits a feasibility study, business plan, institutional assessment or systems assignment.",
          ],
          [
            "Retainer-based",
            "Ongoing professional support",
            "Agree an ongoing engagement for strategic, management and advisory support as business needs develop.",
          ],
        ].map(([v, h, p]) => (
          <article key={v}>
            <Eyebrow>{v} consulting</Eyebrow>
            <h2>{h}.</h2>
            <p>{p}</p>
            <Action to={contactLink("consulting", { engagement: v })}>
              Discuss {v.toLowerCase()} consulting
            </Action>
          </article>
        ))}
      </div>
      <Closing />
    </>
  );
}
export function Industries() {
  return (
    <>
      <Header path="/industries/" over="Sectors" />
      <section className="wrap band sri-v21-industries" aria-label="Browse industries served by SRI">
        <div className="sri-v21-directory-intro">
          <p>Explore the sectors in which SRI connects rural businesses, agricultural products, producer institutions and professional advisory services.</p>
        </div>
        <div className="sri-v21-directory-grid">
          {orderedIndustries(data.industries).map((i, index) => (
            <Link className="sri-v21-industry-card" key={i.slug} to={"/industries/" + i.slug + "/"}>
              <div className="sri-v21-industry-card-head">
                <span className="sri-v21-card-index">{String(index + 1).padStart(2, "0")}</span>
                <ArrowUpRight size={21} aria-hidden="true" />
              </div>
              <h2>{i.title}</h2>
              <p>{i.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
export function Industry() {
  const { slug } = useParams(),
    item = data.industries.find((x) => x.slug === slug);
  if (!item) return <NotFound />;
  const v = data.ventures.find((x) => x.slug === item.venture),
    s = data.consulting.find((x) => x.slug === item.service);
  return (
    <>
      <Seo title={item.title} description={item.description} />
      <Intro
        over="Industry focus"
        title={item.title}
        desc={item.description}
        crumbs={[["Industries", "/industries/"], [item.title]]}
      />
      <section className="wrap band">
        {item.image && <Photo id={item.image} caption className="landscape" />}
        <div className="dual-text band">
          <div>
            <Eyebrow>SRI Ventures</Eyebrow>
            <h2>{v.title}.</h2>
            <p>{v.description}</p>
            <Action to={"/ventures/" + v.slug + "/"}>
              Explore commercial opportunities
            </Action>
          </div>
          <div>
            <Eyebrow>SRI Consulting</Eyebrow>
            <h2>{s.title}.</h2>
            <p>{s.description}</p>
            <Action to={"/consulting/" + s.slug + "/"}>
              Explore advisory services
            </Action>
          </div>
        </div>
        <Action to="/industries/">All industries</Action>
      </section>
    </>
  );
}
export function Partnerships({ ventures = false }) {
  const path = ventures ? "/ventures/partnerships/" : "/partnerships/";
  const options = ventures ? data.partnerTypes.slice(0, 8) : data.partnerTypes;
  return (
    <>
      <Header
        path={path}
        over={ventures ? "SRI Ventures" : "Work with SRI"}
        title={ventures ? "Grow with SRI Ventures." : "Build a partnership."}
      />
      <div className="wrap band split">
        <div>
          <Photo id={ventures ? "weaving" : "planting"} caption />
          <p>
            Choose the relationship you would like to explore. The enquiry form
            will carry your selection to our team.
          </p>
        </div>
        <SimpleLinks
          links={options.map((x) => [
            x,
            contactLink("partnerships", { partnership: x }),
          ])}
        />
      </div>
    </>
  );
}
export function Approach() {
  const r = useData("public/pages/approach");
  return (
    <Resource value={r}>
      {(doc) => (
        <>
          <Seo title={doc.heading} description={doc.intro} />
          <Intro
            title={doc.heading}
            over="How we work"
            desc={doc.intro}
            crumbs={[[doc.heading]]}
          />
          <div className="wrap band approach-grid">
            <div className="sticky-copy">
              <Photo id="majuli" caption />
              <Action to={contactLink("consulting")}>
                Discuss an engagement
              </Action>
            </div>
            <StageList stages={doc.stages} />
          </div>
          <Closing />
        </>
      )}
    </Resource>
  );
}
export function Founder() {
  const r = useData("public/pages/founder");
  return (
    <Resource value={r}>
      {(doc) => (
        <>
          <Seo
            title={doc.heading}
            description={doc.intro}
            image={doc.portrait}
          />
          <Intro
            title={doc.heading}
            over="Founder & leadership"
            desc={doc.intro}
            crumbs={[["About SRI", "/about/"], [doc.heading]]}
          />
          <div className="wrap band founder-grid">
            {doc.portrait ? (
              <Media
                className="founder-portrait"
                url={doc.portrait}
                alt={doc.alt}
              />
            ) : (
              <Photo id="majuli" caption className="portrait-photo" />
            )}
            <div className="prose">
              {doc.name || doc.role || doc.bio ? (
                <>
                  {doc.role && <Eyebrow>{doc.role}</Eyebrow>}
                  {doc.name && <h2>{doc.name}</h2>}
                  {doc.bio && <p className="preserve">{doc.bio}</p>}
                </>
              ) : (
                <>
                  <Eyebrow>Leadership philosophy</Eyebrow>
                  <h2>Building institutions that last.</h2>
                  <p>
                    At SRI, sustainable growth depends on capable people,
                    responsible leadership and meaningful market connections.
                  </p>
                  <p>
                    The founder’s profile and professional history will be
                    shared here after approval.
                  </p>
                </>
              )}
              {doc.milestones.length > 0 && (
                <section>
                  <h3>Professional milestones</h3>
                  <div className="ruled-list">
                    {doc.milestones.map((m, i) => (
                      <div key={i}>
                        <small>{m.period}</small>
                        <h4>{m.organisation}</h4>
                        <p>{m.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <Action to="/about/">Explore the company</Action>
            </div>
          </div>
        </>
      )}
    </Resource>
  );
}
export function Information({ kind }) {
  const s = useSettings(),
    path = "/" + kind + "/";
  return (
    <>
      <Header path={path} over="Website information" />
      <div className="wrap band prose narrow">
        {kind === "credits" ? (
          <>
            <p>
              These photographs document rural life in India, with a focus on
              Assam. They are used as regional editorial imagery. Each bundled
              rendition is resized, converted to WebP and cropped to fit its
              placement.
            </p>
            {data.photos.map((p) => (
              <article key={p.key} className="credit-entry">
                <Photo id={p.key} fit="160px" />
                <div>
                  <h3>{p.file.replace(/\.jpg$/i, "")}</h3>
                  <p>
                    {p.author} · {p.location}
                  </p>
                  <a href={p.source}>Original photograph</a> ·{" "}
                  <a href={p.licenseUrl}>{p.license}</a>
                </div>
              </article>
            ))}
          </>
        ) : s[kind] ? (
          <p className="preserve">{s[kind]}</p>
        ) : kind === "privacy" ? (
          <>
            <h2>Enquiry information</h2>
            <p>
              When you submit a form, this website records your contact details,
              your message, the selected enquiry type and the submission time.
              Authorised staff can review these details to respond and follow
              up.
            </p>
            <p>
              If email is enabled, a reference is sent to the address you
              provide. Staff administration uses an essential session cookie.
              The introduction uses browser session storage.
            </p>
            <h2>Human verification</h2>
            <p>
              When Cloudflare Turnstile is enabled on the contact form,
              Cloudflare processes verification information to help prevent
              automated and abusive submissions. Review Cloudflare’s
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer"> privacy policy</a>
              for details about its processing.
            </p>
            {s.analytics_id && (
              <p>
                Optional Google Analytics runs when you allow it in the footer.
                You can disable it there at any time.
              </p>
            )}
            {s.newsletter && (
              <p>
                Insights subscriptions require email confirmation. Each
                newsletter includes a personal unsubscribe link.
              </p>
            )}
            <Action to={contactLink("general", { subject: "Privacy enquiry" })}>
              Contact SRI about your information
            </Action>
          </>
        ) : (
          <>
            <h2>Products and services</h2>
            <p>
              The website introduces SRI’s commercial and consulting activities.
              Submitting an enquiry starts a conversation about your
              requirements. Product specifications, availability, engagement
              scope and commercial terms are confirmed directly with the team.
            </p>
            <Action to="/contact/">Contact SRI</Action>
          </>
        )}
      </div>
    </>
  );
}

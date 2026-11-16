import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import content from "@shared/content.json";
import { useData, dateLabel, catalogueBases } from "../lib/api";
import { useSettings } from "../lib/context";
import {
  Action,
  Empty,
  Eyebrow,
  Photo,
  Resource,
  SectionTitle,
  Seo,
  Media,
} from "../components/ui";
import { Closing } from "../components/layout";

export function PublishedTiles({ kind, home = false }) {
  const result = useData(
    "public/content/" +
      kind +
      "?limit=3" +
      (kind === "articles" ? "&sort=latest" : ""),
  );
  return (
    <Resource value={result}>
      {({ items }) =>
        items.length ? (
          <div className="teaser-list">
            {items.map((d) => (
              <article key={d.id}>
                <Link to={catalogueBases[kind] + d.slug + "/"}>
                  {d.cover && <Media url={d.cover} alt={d.cover_alt} />}
                  <small>
                    {d.category}
                    {kind === "articles" && " · " + dateLabel(d.published_at)}
                  </small>
                  <h3>{d.title}</h3>
                </Link>
                <p>{d.excerpt}</p>
                <Action to={catalogueBases[kind] + d.slug + "/"}>
                  {kind === "articles" ? "Read article" : "Read case study"}
                </Action>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={
              kind === "articles"
                ? "The journal is taking shape."
                : "Discuss a project with SRI."
            }
            body={
              kind === "articles"
                ? "Our journal will bring together perspectives on rural business, producer institutions and sustainable growth."
                : "Case studies will appear here as they are approved for publication. Our team welcomes enquiries about your assignment."
            }
            to={
              kind === "articles"
                ? home
                  ? "/insights/"
                  : "/contact/?type=general"
                : "/contact/?type=consulting"
            }
            action={
              kind === "articles"
                ? home
                  ? "Visit the journal"
                  : "Contact the editorial team"
                : "Discuss your requirements"
            }
          />
        )
      }
    </Resource>
  );
}
export function StageList({ stages, compact = false }) {
  return (
    <div className={"stage-list " + (compact ? "mini" : "")}>
      <span className="stage-rail" aria-hidden="true">
        <i data-progress />
      </span>
      {stages.map((stage, i) => (
        <article className="stage" key={i}>
          <span className="stage-number">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h3>{stage.name}</h3>
            <p>{stage.description}</p>
            {stage.image && !compact && (
              <Media url={stage.image} alt={stage.alt} />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
function HomeApproach() {
  const r = useData("public/pages/approach");
  return (
    <section className="band approach-band">
      <div className="wrap approach-grid">
        <Resource value={r}>
          {(doc) => (
            <>
              <div className="sticky-copy">
                <Eyebrow>How we work</Eyebrow>
                <h2 data-reveal>{doc.heading}</h2>
                <p>{doc.intro}</p>
                <Action to="/our-approach/">Explore our approach</Action>
              </div>
              <StageList stages={doc.stages} compact />
            </>
          )}
        </Resource>
      </div>
    </section>
  );
}
const expertise = [
  [
    "Farm inputs",
    "Feed, supplements and farm management products.",
    "/ventures/farm-inputs/",
  ],
  [
    "Farm & agricultural produce",
    "Connecting producers with consumers and institutional buyers.",
    "/ventures/farm-outputs/",
  ],
  [
    "Handloom products",
    "Traditional textiles, producer groups and wider markets.",
    "/ventures/handloom/",
  ],
  [
    "Business strategy & management",
    "Growth planning, operations and business development.",
    "/consulting/business-strategy/",
  ],
  [
    "Livestock & agribusiness consulting",
    "Viable enterprise models and stronger value chains.",
    "/consulting/livestock-agribusiness/",
  ],
  [
    "Institutional development",
    "Governance and professional management for producer organisations.",
    "/consulting/fpo-development/",
  ],
];
export default function Home() {
  const s = useSettings(),
    [sector, setSector] = useState("majuli");
  return (
    <>
      <Seo
        title={s.name}
        description={s.seo_description}
        image="/images/seedlings-1200.webp"
      />
      <section className="hero wrap">
        <div className="hero-copy">
          <Eyebrow>{s.tagline}</Eyebrow>
          <h1 aria-label="Connecting resources, businesses and opportunities.">
            {[
              "Connecting",
              "resources,",
              "businesses and",
              "opportunities.",
            ].map((line, i) => (
              <span className="hero-line" key={line}>
                <span style={{ "--i": i }}>{line}</span>
              </span>
            ))}
          </h1>
          <p className="hero-lead">{content.pages["/"].description}</p>
          <div className="actions hero-actions">
            <Action variant="solid" to="/ventures/">
              Explore SRI Ventures
            </Action>
            <Action variant="outline" to="/consulting/">
              Explore SRI Consulting
            </Action>
          </div>
          <a className="scroll-link" href="#two-verticals">
            <ArrowDown size={15} /> Explore the company
          </a>
        </div>
        <figure className="hero-image">
          <div className="hero-frame">
            <div data-parallax>
              <img
                fetchPriority="high"
                alt={content.photos.find((x) => x.key === "seedlings").alt}
                src="/images/seedlings-1200.webp"
                srcSet="/images/seedlings-640.webp 640w, /images/seedlings-1200.webp 1200w, /images/seedlings-1920.webp 1920w"
                sizes="(max-width: 800px) 94vw, 50vw"
                width="1600"
                height="862"
              />
            </div>
          </div>
          <figcaption>
            <span>Rice planting</span>
            <span>Assam, India</span>
          </figcaption>
        </figure>
      </section>
      <section id="two-verticals" className="wrap band">
        <div className="intro-spread">
          <div>
            <Eyebrow>The company</Eyebrow>
            <h2 data-reveal>
              Two verticals.
              <br />
              One vision.
            </h2>
          </div>
          <div>
            <p className="lead">
              Sustainable growth begins with the people who produce, the markets
              they reach and the institutions they build.
            </p>
            <Action to="/about/">About SRI</Action>
          </div>
        </div>
        <div className="vertical-pair">
          {[
            [
              "Ventures",
              "Connecting inputs, outputs and markets.",
              "majuli",
              "For buyers, suppliers and producers",
              "/ventures/",
            ],
            [
              "Consulting",
              "Building businesses. Strengthening institutions.",
              "planting",
              "For enterprises, institutions and partners",
              "/consulting/",
            ],
          ].map(([name, line, img, over, url]) => (
            <article key={name} className={"vertical " + name.toLowerCase()}>
              <Photo id={img} fit="(max-width: 740px) 90vw, 48vw" />
              <div>
                <p>{over}</p>
                <h3>SRI {name}</h3>
                <p className="vertical-line">{line}</p>
                <Action to={url}>Explore SRI {name}</Action>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="band expertise-band">
        <div className="wrap split">
          <div>
            <Eyebrow>Products & services</Eyebrow>
            <h2 data-reveal>
              Our
              <br />
              expertise.
            </h2>
            <Photo
              id="weaving"
              className="expert-photo"
              fit="(max-width: 740px) 90vw, 32vw"
              caption
            />
          </div>
          <div className="editorial-index">
            {expertise.map(([title, desc, to]) => (
              <Link key={to} to={to}>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="wrap band">
        <SectionTitle
          label="Markets & institutions"
          title="Industries we serve."
        >
          <Action to="/industries/">All industries</Action>
        </SectionTitle>
        <div className="industry-preview">
          <Photo id={sector} caption fit="(max-width: 740px) 90vw, 48vw" />
          <div className="industry-links">
            {content.industries.map((i) => (
              <Link
                key={i.slug}
                to={"/industries/" + i.slug + "/"}
                onFocus={() => setSector(i.image || "dairy")}
                onMouseEnter={() => setSector(i.image || "dairy")}
              >
                {i.title}
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="why-band band">
        <div className="wrap split">
          <div>
            <Eyebrow>Our perspective</Eyebrow>
            <h2 data-reveal>Why SRI?</h2>
          </div>
          <div className="why-list">
            {content.why.map(([title, desc]) => (
              <div key={title}>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <HomeApproach />
      <section className="wrap band stories">
        <SectionTitle title="Our work." label="Practice">
          <Action to="/our-work/">All case studies</Action>
        </SectionTitle>
        <PublishedTiles kind="case-studies" home />
      </section>
      <section className="wrap band journal-band">
        <SectionTitle title="Insights & perspectives." label="The journal">
          <Action to="/insights/">All insights</Action>
        </SectionTitle>
        <PublishedTiles kind="articles" home />
      </section>
      <Closing />
    </>
  );
}

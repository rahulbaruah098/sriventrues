import { orderedIndustries } from "../lib/industryOrder";
import Relationships from "./Relationships";
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
                    {kind === "articles" && " Â· " + dateLabel(d.published_at)}
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
    "Livestock & agribusiness consulting",
    "Viable enterprise models and stronger value chains.",
    "/consulting/livestock-agribusiness/",
  ],
  [
    "Business strategy & management",
    "Growth planning, operations and business development.",
    "/consulting/business-strategy/",
  ],
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
    "Institutional development",
    "Governance and professional management for producer organisations.",
    "/consulting/fpo-development/",
  ],
];
export default function Home() {
  const s = useSettings(),
    [sector, setSector] = useState("agriculture-agribusiness");
  const industryImages = useData("public/industry-images");
  const industrySelection = content.industries.find((item) => item.slug === sector) || content.industries[0];
  const chosenIndustryImage = (industryImages.data?.items || []).find((item) => item.slug === sector);
  return (
    <>
      <Seo
        title={s.name}
        description={s.seo_description}
        image="/images/seedlings-1200.webp"
      />
      <section className="hero hero-reference-v2" aria-label="SRI introduction">
        <div className="hero-copy hero-reference-copy">
          <h1 className="hero-reference-title">
            <span>Building Better</span>
            <span>Businesses.</span>
            <span>Strengthening</span>
            <span>Communities.</span>
          </h1>
          <p className="hero-reference-lead">
            Supporting farmers, producer institutions and rural enterprises with
            practical solutions, market linkages and long-term growth strategies.
          </p>
          <div className="actions hero-reference-actions">
            <a className="action solid" href="#home-expertise">Our Expertise <ArrowUpRight size={22} /></a>
            <Link className="action outline" to="/contact/">Contact Us <ArrowUpRight size={22} /></Link>
          </div>
        </div>
        <figure className={"hero-reference-art" + (s.hero_image ? " hero-custom-image" : "")}>
          <img
            src={s.hero_image || "/images/sri-hero-reference.webp"}
            alt={s.hero_image ? (s.hero_image_alt || "SRI homepage hero photograph") : "Woman farmer carrying a basket of green crops in a sunny rural field"}
            width="982"
            height="941"
            fetchPriority="high"
          />
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
              "/images/sri-ventures-vertical.png",
              "For buyers, suppliers and producers",
              "/ventures/",
            ],
            [
              "Consulting",
              "Building businesses. Strengthening institutions.",
              "/images/sri-consulting-vertical.jpeg",
              "For enterprises, institutions and partners",
              "/consulting/",
            ],
          ].map(([name, line, img, over, url]) => (
            <article key={name} className={"vertical " + name.toLowerCase()}>
              <div className="photo vertical-custom-photo"><div className="image-window"><img src={img} alt={`SRI ${name}`} loading="lazy" onError={(event) => { event.currentTarget.src = name === "Ventures" ? "/images/majuli-1200.webp" : "/images/planting-1200.webp"; event.currentTarget.onerror = null; }} /></div></div>
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
      <section id="home-expertise" className="band expertise-band">
        <div className="wrap split">
          <div>
            <Eyebrow>Products & services</Eyebrow>
            <h2 data-reveal>
              Our
              <br />
              expertise.
            </h2>
            <figure className="photo expert-photo expert-static-photo">
              <div className="image-window">
                <img
                  src="/images/sri-expertise.jpg"
                  alt="SRI expertise in rural enterprise and agribusiness"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    const image = event.currentTarget;
                    const formats = [".jpg", ".jpeg", ".png", ".webp"];
                    const index = formats.findIndex((ext) => image.src.split("?")[0].toLowerCase().endsWith("/sri-expertise" + ext));
                    if (index >= 0 && index < formats.length - 1) {
                      image.src = "/images/sri-expertise" + formats[index + 1];
                    } else {
                      image.onerror = null;
                      image.src = "/images/weaving-1200.webp";
                    }
                  }}
                />
              </div>
            </figure>
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
          <Photo
            id={industrySelection.image || "dairy"}
            caption
            overrideUrl={chosenIndustryImage?.image || ""}
            overrideAlt={chosenIndustryImage?.alt || industrySelection.title}
            fit="(max-width: 740px) 90vw, 48vw"
          />

          <div className="industry-links">
            {[...content.industries]
              .sort((a, b) => {
                const order = [
                  "poultry",
                  "piggery",
                  "goatery",
                  "dairy",
                  "agriculture-agribusiness",
                ];

                const aIndex = order.indexOf(a.slug);
                const bIndex = order.indexOf(b.slug);

                return (
                  (aIndex < 0 ? order.length : aIndex) -
                  (bIndex < 0 ? order.length : bIndex)
                );
              })
              .map((i) => (
                <Link
                  key={i.slug}
                  to={"/industries/" + i.slug + "/"}
                  onFocus={() => setSector(i.slug)}
                  onMouseEnter={() => setSector(i.slug)}
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
      <Relationships />
    </>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import data from "@shared/content.json";
import { Subscription } from "./Newsletter";
import {
  Action,
  Crumbs,
  Empty,
  Eyebrow,
  Intro,
  Media,
  NotFound,
  Resource,
  Seo,
} from "../components/ui";
import {
  catalogueBases,
  contactLink,
  dateLabel,
  toQuery,
  useData,
} from "../lib/api";

const emptyText = {
  articles: [
    "The journal is taking shape.",
    "Articles will appear here after editorial approval. Explore our approach to enterprise development in the meantime.",
    "Our approach",
    "/our-approach/",
  ],
  "case-studies": [
    "Discuss a project with SRI.",
    "Approved case studies will describe the challenge, our role and verified outcomes. Contact us about the work you have in mind.",
    "Discuss a project",
    contactLink("consulting"),
  ],
  products: [
    "Looking for a particular product?",
    "Our published catalogue will appear here. You can already enquire about specifications, quantities and sourcing across our three product streams.",
    "Make a product enquiry",
    contactLink("ventures"),
  ],
};
export function Pager({ total, page, limit, change }) {
  if (total <= limit) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {Math.ceil(total / limit)}
      </span>
      <button disabled={page * limit >= total} onClick={() => change(page + 1)}>
        Next
      </button>
    </nav>
  );
}
function Tile({ item, kind, feature = false }) {
  return (
    <article className={"collection-tile " + (feature ? "feature" : "")}>
      {item.cover && (
        <Link
          tabIndex={-1}
          aria-hidden="true"
          to={catalogueBases[kind] + item.slug + "/"}
        >
          <Media url={item.cover} alt={item.cover_alt} />
        </Link>
      )}
      <div>
        {feature && (
          <Eyebrow>
            {item.featured ? "Featured insight" : "Latest insight"}
          </Eyebrow>
        )}
        <small>
          {item.category}
          {kind === "articles"
            ? " · " + dateLabel(item.published_at)
            : item.vertical
              ? " · " + item.vertical
              : ""}
        </small>
        <h2>
          <Link to={catalogueBases[kind] + item.slug + "/"}>{item.title}</Link>
        </h2>
        <p>{item.excerpt}</p>
        <Action to={catalogueBases[kind] + item.slug + "/"}>
          {kind === "articles"
            ? "Read article"
            : kind === "products"
              ? "View product"
              : "Read case study"}
        </Action>
      </div>
    </article>
  );
}
export function Collection({ kind }) {
  const base = catalogueBases[kind],
    p = data.pages[base],
    [params, setParams] = useSearchParams();
  const q = params.get("q") || "",
    category = params.get("category") || "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [term, setTerm] = useState(q);
  useEffect(() => {
    setTerm(q);
  }, [q]);
  const change = (values) =>
    setParams(toQuery({ q, category, page: 1, ...values }));
  const r = useData(
    "public/content/" + kind + "?" + toQuery({ q, category, page, limit: 9 }),
  );
  const categories =
    kind === "articles"
      ? data.articleCategories
      : kind === "products"
        ? data.ventures.map((v) => v.title)
        : data.industries.map((i) => i.title);
  const empty = emptyText[kind];
  return (
    <>
      <Seo title={p.title} description={p.description} />
      <Intro
        over={
          kind === "articles"
            ? "SRI journal"
            : kind === "products"
              ? "SRI Ventures"
              : "Projects & case studies"
        }
        title={p.title}
        desc={p.description}
        crumbs={[[p.title]]}
      />
      <section className="wrap band listing">
        <form
          className="filterbar"
          onSubmit={(e) => {
            e.preventDefault();
            change({ q: term });
          }}
        >
          <label>
            <span>
              Search {kind === "case-studies" ? "case studies" : kind}
            </span>
            <div className="input-icon">
              <Search size={17} />
              <input
                value={term}
                maxLength={120}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search by keyword"
              />
            </div>
          </label>
          <label>
            <span>{kind === "case-studies" ? "Industry" : "Category"}</span>
            <select
              value={category}
              onChange={(e) => change({ category: e.target.value, q: term })}
            >
              <option value="">
                All {kind === "case-studies" ? "industries" : "categories"}
              </option>
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Search
          </button>
          {(q || category) && (
            <button
              className="text-button"
              type="button"
              onClick={() => setParams({})}
            >
              Clear filters
            </button>
          )}
        </form>
        <Resource value={r}>
          {(result) => {
            const feature =
              kind === "articles" &&
              page === 1 &&
              !q &&
              !category &&
              result.items[0];
            return (
              <>
                {result.items.length === 0 ? (
                  q || category || page > 1 ? (
                    <Empty
                      title="No matches."
                      body="Try another search or clear your filters."
                    />
                  ) : (
                    <Empty
                      title={empty[0]}
                      body={empty[1]}
                      action={empty[2]}
                      to={empty[3]}
                    />
                  )
                ) : (
                  <>
                    {feature && <Tile item={feature} kind={kind} feature />}
                    <div className={"collection " + kind}>
                      {result.items.slice(feature ? 1 : 0).map((d) => (
                        <Tile key={d.id} item={d} kind={kind} />
                      ))}
                    </div>
                  </>
                )}
                <Pager {...result} change={(p) => change({ page: p })} />
              </>
            );
          }}
        </Resource>
        {kind === "articles" && <Subscription />}
      </section>
    </>
  );
}
function Related({ kind, doc }) {
  const r = useData(
    "public/content/" +
      kind +
      "?" +
      toQuery({ category: doc.category, limit: 4 }),
  );
  const related =
    r.data?.items.filter((x) => x.id !== doc.id).slice(0, 3) || [];
  return related.length ? (
    <aside className="related">
      <h2>Related {kind === "articles" ? "articles" : "products"}</h2>
      {related.map((x) => (
        <Action key={x.id} to={catalogueBases[kind] + x.slug + "/"}>
          {x.title}
        </Action>
      ))}
    </aside>
  ) : null;
}
function Gallery({ items }) {
  return items?.length ? (
    <div className="gallery">
      {items.map((g, i) => (
        <figure key={i}>
          <Media url={g.url} alt={g.alt} />
          {g.alt && <figcaption>{g.alt}</figcaption>}
        </figure>
      ))}
    </div>
  ) : null;
}
export function Detail({ kind }) {
  const { slug } = useParams(),
    r = useData("public/content/" + kind + "/" + encodeURIComponent(slug)),
    base = catalogueBases[kind];
  if (r.error?.status === 404) return <NotFound />;
  return (
    <Resource value={r}>
      {(doc) => (
        <>
          <Seo
            title={doc.seo_title || doc.title}
            description={doc.seo_description || doc.excerpt}
            image={doc.cover}
            type={kind === "articles" ? "article" : "website"}
            author={doc.author}
            published={kind === "articles" ? doc.published_at : undefined}
          />
          <div className="wrap">
            <Crumbs items={[[data.pages[base].title, base], [doc.title]]} />
          </div>
          {kind === "products" ? (
            <section className="wrap band product-view">
              <div>
                {doc.cover ? (
                  <Media url={doc.cover} alt={doc.cover_alt} />
                ) : (
                  <div className="product-type">
                    <Eyebrow>Product category</Eyebrow>
                    <h2>{doc.category}</h2>
                  </div>
                )}
                <Gallery items={doc.gallery} />
              </div>
              <div className="prose">
                <Eyebrow>{doc.category}</Eyebrow>
                <h1>{doc.title}</h1>
                <p className="lead">{doc.excerpt}</p>
                <p className="preserve">{doc.description}</p>
                <dl className="specs">
                  {[
                    ["Manufacturer", doc.manufacturer],
                    ["Pack size", doc.pack_size],
                    ["Specifications", doc.specifications],
                    ["Availability", doc.availability],
                  ]
                    .filter((x) => x[1])
                    .map(([l, v]) => (
                      <div key={l}>
                        <dt>{l}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                <Action
                  variant="solid"
                  to={contactLink("ventures", {
                    category: doc.category,
                    product: doc.title,
                    intent: "Request a quote",
                  })}
                >
                  Request a quote
                </Action>
                <Related kind={kind} doc={doc} />
              </div>
            </section>
          ) : (
            <article className="wrap band detail-page">
              <header className="reading-head">
                <Eyebrow>
                  {doc.category}
                  {doc.vertical ? " · " + doc.vertical : ""}
                </Eyebrow>
                <h1>{doc.title}</h1>
                <p className="lead">{doc.excerpt}</p>
                {kind === "articles" && (
                  <p className="byline">
                    {doc.author && (
                      <>
                        <strong>{doc.author}</strong> ·{" "}
                      </>
                    )}
                    <time dateTime={doc.published_at}>
                      {dateLabel(doc.published_at)}
                    </time>
                  </p>
                )}
              </header>
              {doc.cover && (
                <Media
                  url={doc.cover}
                  alt={doc.cover_alt}
                  className="detail-cover"
                />
              )}
              <div className="reading-body">
                {kind === "articles" ? (
                  <>
                    <div
                      className="rich-body"
                      dangerouslySetInnerHTML={{ __html: doc.body }}
                    />
                    <Related kind={kind} doc={doc} />
                  </>
                ) : (
                  <>
                    {doc.client && (
                      <p className="byline">Client / project · {doc.client}</p>
                    )}
                    {[
                      ["The challenge", doc.challenge],
                      ["SRI’s role", doc.role],
                      ["Intervention & methodology", doc.intervention],
                      ["Verified outcomes", doc.outcomes],
                    ].map(([l, v]) => (
                      <section key={l}>
                        <h2>{l}</h2>
                        <p className="preserve">{v}</p>
                      </section>
                    ))}
                    <Gallery items={doc.gallery} />
                    {doc.related_services?.length > 0 && (
                      <aside className="related">
                        <h2>Related services</h2>
                        {doc.related_services.map((p) => (
                          <Action key={p} to={p}>
                            {data.pages[p].title}
                          </Action>
                        ))}
                      </aside>
                    )}
                  </>
                )}
                <div className="actions">
                  <Action to={base}>
                    Back to {kind === "articles" ? "Insights" : "Our Work"}
                  </Action>
                  <Action
                    to={contactLink(
                      kind === "case-studies" && doc.vertical === "SRI Ventures"
                        ? "ventures"
                        : "consulting",
                    )}
                  >
                    Discuss your requirements
                  </Action>
                </div>
              </div>
            </article>
          )}
        </>
      )}
    </Resource>
  );
}

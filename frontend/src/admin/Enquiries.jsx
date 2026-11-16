import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import content from "@shared/content.json";
import { api, dateLabel, labels, statuses, toQuery, useData } from "../lib/api";
import { Resource } from "../components/ui";
import { Pager } from "../public/Collections";
import { AdminTitle, Feedback, Field, useSave } from "./controls";

export function Inbox() {
  const [params, setParams] = useSearchParams(),
    q = params.get("q") || "",
    status = params.get("status") || "",
    type = params.get("type") || "",
    sort = params.get("sort") || "newest",
    page = Number(params.get("page")) || 1;
  const [term, setTerm] = useState(q),
    filters = { q, status, type, sort };
  const update = (values) =>
    setParams(toQuery({ ...filters, page: 1, ...values }));
  const r = useData(
    "admin/enquiries?" + toQuery({ ...filters, page, limit: 15 }),
  );
  return (
    <>
      <AdminTitle
        title="Enquiries"
        description="View and follow up on submitted business enquiries."
      >
        <a
          className="button secondary"
          href={"/api/admin/enquiries/export.csv?" + toQuery(filters)}
          download
        >
          Export filtered CSV
        </a>
      </AdminTitle>
      <form
        className="filterbar inbox-filters"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: term });
        }}
      >
        <Field
          label="Name, email or reference"
          value={term}
          onChange={setTerm}
        />
        <label>
          Journey
          <select
            value={type}
            onChange={(e) => update({ type: e.target.value, q: term })}
          >
            <option value="">All journeys</option>
            {Object.keys(content.forms).map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => update({ status: e.target.value, q: term })}
          >
            <option value="">All statuses</option>
            {statuses.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Order
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value, q: term })}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
        <button className="button">Search</button>
      </form>
      <Resource value={r}>
        {(d) => (
          <>
            {d.items.length ? (
              <div
                className="table-wrap"
                tabIndex={0}
                aria-label="Enquiries table, scroll horizontally"
              >
                <table>
                  <thead>
                    <tr>
                      {[
                        "Reference",
                        "Name / organisation",
                        "Email / phone",
                        "Journey",
                        "Submitted (IST)",
                        "Status",
                        "Action",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((e) => (
                      <tr key={e.id}>
                        <td>{e.reference}</td>
                        <td>
                          {e.data.name}
                          <small>{e.data.organisation}</small>
                        </td>
                        <td>
                          {e.data.email}
                          <small>{e.data.phone}</small>
                        </td>
                        <td>{labels[e.type]}</td>
                        <td>{dateLabel(e.created_at, true)}</td>
                        <td>{e.status}</td>
                        <td>
                          <Link to={"/admin/enquiries/" + e.id}>
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel">
                <p>No enquiries match this view.</p>
              </div>
            )}
            <Pager {...d} change={(page) => update({ page })} />
          </>
        )}
      </Resource>
    </>
  );
}
function Record({ initial }) {
  const [doc, setDoc] = useState(initial),
    [status, setStatus] = useState(doc.status),
    [notes, setNotes] = useState(doc.notes),
    state = useSave();
  return (
    <>
      <Link className="back" to="/admin/enquiries">
        ← Enquiries
      </Link>
      <AdminTitle
        title={doc.reference}
        description={
          labels[doc.type] + " · " + dateLabel(doc.created_at, true) + " IST"
        }
      />
      <div className="admin-columns">
        <section className="panel">
          <h2>Submission details</h2>
          <dl className="specs">
            {content.forms[doc.type].map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{doc.data[f.key] || "—"}</dd>
              </div>
            ))}
            <div>
              <dt>Email delivery</dt>
              <dd>{doc.email_status}</dd>
            </div>
          </dl>
        </section>
        <form
          className="panel editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            state.run(async () => {
              const result = await api("admin/enquiries/" + doc.id, {
                method: "PUT",
                data: { status, notes, version: doc.version },
              });
              setDoc(result);
            });
          }}
        >
          <h2>Follow-up</h2>
          <Field
            label="Status"
            options={statuses}
            required
            value={status}
            onChange={setStatus}
          />
          <Field
            label="Internal notes"
            type="textarea"
            rows={8}
            value={notes}
            onChange={setNotes}
          />
          {doc.handled_by && (
            <p>
              Last handled by {doc.handled_by} ·{" "}
              {dateLabel(doc.updated_at, true)} IST
            </p>
          )}
          <Feedback {...state} />
          <button className="button" disabled={state.busy}>
            Save follow-up
          </button>
        </form>
      </div>
    </>
  );
}
export function EnquiryDetail() {
  const { id } = useParams(),
    r = useData("admin/enquiries/" + id);
  return (
    <Resource value={r}>{(doc) => <Record key={id} initial={doc} />}</Resource>
  );
}

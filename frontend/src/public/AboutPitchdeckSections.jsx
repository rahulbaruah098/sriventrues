import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Eyebrow } from "../components/ui";
import "../styles/sri-company-industries-v21.css";

// SRI Pitchdeck, November 2026, pages 1, 3–12.
// Proposed developments are deliberately described as plans, not launched products.
export default function AboutPitchdeckSections() {
  return (
    <>
      <section className="wrap band sri-company-overview-v21" aria-labelledby="sri-business-heading">
        <div className="sri-v21-section-intro">
          <div>
            <Eyebrow>One company. Complementary strengths.</Eyebrow>
            <h2 id="sri-business-heading" data-reveal>Enterprise-led rural innovation.</h2>
          </div>
          <p className="lead">
            SRI connects farm inputs and market-led outputs with professional
            business consulting. Our work brings together commercially viable
            enterprises, farmer-centric solutions and stronger producer institutions.
          </p>
        </div>
        <div className="sri-v21-business-grid">
          <article className="sri-v21-business-item">
            <span className="sri-v21-item-number">01 / Product and market development</span>
            <h3>SRI Ventures</h3>
            <p>Connecting livestock feed, farm inputs, agricultural and livestock produce,
              and handloom products with buyers, sourcing partners and markets.</p>
            <Link to="/ventures/">Explore SRI Ventures <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </article>
          <article className="sri-v21-business-item">
            <span className="sri-v21-item-number">02 / Knowledge and services</span>
            <h3>SRI Consulting</h3>
            <p>Supporting business strategy, enterprise growth, FPC development,
              governance, institutional capacity, management systems and livestock
              value-chain advisory.</p>
            <Link to="/consulting/">Explore SRI Consulting <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </article>
        </div>
      </section>
      <section className="sri-v21-focus-band band" aria-labelledby="sri-focus-heading">
        <div className="wrap sri-v21-focus-layout">
          <div>
            <Eyebrow>Where we focus</Eyebrow>
            <h2 id="sri-focus-heading" data-reveal>From farms to sustainable enterprises.</h2>
            <p>Livestock value chains, rural entrepreneurs and producer organisations
              need practical business models, professional systems and lasting market connections.</p>
          </div>
          <div className="sri-v21-focus-list">
            <article><h3>Livestock &amp; agribusiness</h3><p>Business planning, animal nutrition and market linkages across poultry, piggery, dairy and related rural sectors.</p></article>
            <article><h3>Producer institutions</h3><p>FPC development, governance, capacity building and operational management.</p></article>
            <article><h3>Rural commerce</h3><p>Farm inputs, agricultural outputs, handloom products, sourcing and institutional buyer relationships.</p></article>
          </div>
        </div>
      </section>
      <section className="wrap band sri-v21-innovation" aria-labelledby="sri-innovation-heading">
        <div className="sri-v21-section-intro">
          <div>
            <Eyebrow>Innovation in development</Eyebrow>
            <h2 id="sri-innovation-heading" data-reveal>Exploring science-led livestock nutrition.</h2>
          </div>
          <div>
            <p className="lead">NUTRI-FEED is a concept-stage initiative to explore
              standardised fermented feed ingredients using selected local agricultural by-products.</p>
            <p>The proposed initial focus is poultry, with species-specific piggery and dairy
              development paths subject to laboratory validation, pilot production and controlled feeding trials.</p>
            <p className="sri-v21-status-note"><strong>Development status:</strong> Concept / proposed pilot. No commercial availability, performance improvement or cost-saving claim is made at this stage.</p>
            <Link className="sri-v21-text-action" to="/contact/?type=ventures">Discuss a partnership <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}

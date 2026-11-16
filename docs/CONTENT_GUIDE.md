# Content and image handover

The source is the supplied 14-page SRI website project file. Business architecture comes from pages 3–4, homepage and commercial copy from pages 5–7, consulting detail from pages 7–9, and the vision, mission, values, leadership structure, approach and partnerships from pages 9–10. Pages 11–14 inform brand tokens, enquiry routing, launch dependencies and the draft article plan. The page 2 image informed the relationship between the corporate identity, services and industry navigation.

The public presentation uses the approved navy #102B50, forest #087451 and lime #B7CF45. The two verticals share navigation and branding. Ventures uses a catalogue and business enquiries. Consulting offers project-based or retainer-based advisory. Regional documentary photographs carry source and licence credits in the public footer.

## What a fresh database contains

| Public at first start | Staff material awaiting approval |
| --- | --- |
| Approved corporate, commercial, consulting and industry descriptions | Seven article concepts saved as drafts |
| Five approach stages with their descriptions | A proposed founder biography in the working copy |
| A dedicated founder page explaining SRI's founder-led philosophy | Fields for verified name, portrait, qualifications and attributed professional milestones |
| A text-based corporate identifier | Official logo, address, email, phone, social links and optional corporate profile PDF |
| Catalogue and case-study introductions with enquiry actions | Product records, authorised case studies, outcomes, specifications and galleries |

Private biographies and draft articles are excluded from the public JSON, production frontend source data and public page responses. Initialisation is repeatable. It preserves edits and intentional deletions.

## Publication decisions

Publish product specifications and regulated-product descriptions only after internal review. Use photographs with permission and meaningful descriptions. Identify the responsible organisation for each founder assignment. Add only authorised clients, results and case studies. The selected domain in the planning document requires ownership verification. Set the confirmed origin in deployment configuration. The two built-in website notices describe actual technical behaviour and can be replaced with the organisation’s approved privacy policy and terms.

## Editorial source locations

`shared/content.json` holds public category definitions, navigation facts, form schemas and company copy. `backend/app/seed_data.json` holds private initial drafts and page seeds. Published dynamic records are read from MongoDB at request time. See `LICENSE-ASSETS.md` for image and typeface provenance.

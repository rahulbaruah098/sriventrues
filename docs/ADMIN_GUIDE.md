# Staff guide

Sign in at `/admin/login` using the email registered by the technical administrator. The dashboard links directly to draft and published content and to new enquiries.

## Working with content

- **Insights & Articles** begins with seven working titles. Open one, enter its summary, category, author if supplied, and full approved body. The editor supports headings, lists, emphasis, quotations, links and uploaded images. Add a cover description for screen readers. The Featured checkbox gives an article precedence in the journal.
- **Our Work / Case Studies** records the project, industry, vertical, authorised client name, challenge, SRI’s role, intervention, verified outcomes, cover and gallery. Link relevant service pages. Smaller ordering numbers appear first.
- **Product Catalogue** groups entries into Farm Inputs, Farm Outputs and Handloom Products. Add approved descriptions, brand/manufacturer, availability, pack size, specifications and images. The public quote button carries the product and category to a Ventures enquiry.
- **Our Approach** holds the page introduction and ordered stages. Move stages up or down, add an image and description, or disable a stage. Save a working draft while preparing changes. Publish updates both the standalone page and homepage.
- **Know the Founder** has its own module and public address `/know-the-founder/`. Review the proposed profile text. Enter the verified name, role, approved biography and portrait. Each career milestone must specify the organisation responsible for the work. Save drafts privately, then publish. The About page and both site menus link to this page.
- For an article, product or case, **Save draft** keeps a new record private. **Unpublish to draft** removes a previously public item from listings, its direct URL and the sitemap. Changing a slug changes its public address. Delete requires confirmation.

Editors receive a conflict message if someone else has saved the same record. Keep a copy of your text, reload, compare the new version and reapply your change.

## Branding and settings

Open **Company Branding**, select the official logo, inspect the navbar and footer previews and save. Both locations read one configuration. Each replacement has a new asset URL. Open tabs refresh on focus, on cross-tab publication events or within 45 seconds. The footer uses a light backing where needed to preserve the supplied artwork. Export complex SVG artwork as plain paths or supply a transparent PNG. The display-width control retains the original aspect ratio.

In **Website Settings**, enter verified address, telephone, WhatsApp, email, opening hours, public social profiles, approved policy text and SEO defaults. Upload an authorised corporate profile PDF if available. Unconfigured contact channels are hidden.

## Enquiries

Use the journey tabs on the public contact page. Partner, product and service links preselect relevant fields. Each accepted submission gets a reference visible to the visitor. Staff can search by reference, name, email, organisation or phone. Filter by journey and status, sort results and export the filtered rows. In **View details**, see the full submission and email delivery state, add internal follow-up notes and change status. The inbox and CSV contain personal contact information and require a staff login.

## Access and maintenance

Use **Admin Account** to change your email or password. Confirm the current password. Other sessions expire when an account is changed. Sign out after using a shared machine. The server command `python -m flask --app run create-admin` adds an individual account with a hidden password prompt. The application includes no default staff account.

Upload replacements remain available to records that still use them. To reclaim old detached files, run `python -m flask --app run prune-media` to preview files unused for at least seven days. Run with `--apply` only during a maintenance window with editorial writes stopped. Referenced draft and published files are retained.

If the newsletter is enabled, **Website Settings → Export confirmed subscribers** exports subscribers and their personal unsubscribe links. Include that link when preparing each issue in your mailing tool.

## Why

The current Properties page is a basic search list that sends users into a separate `/app/properties/[propertyId]` page for every meaningful action. This conflicts with the CRM workspace direction defined in `resources/properties-design.json`, where users should browse, filter, select, review images, and act on listings from a single operational surface. Property images are also barely used today, even though they are the fastest way for an REN to recognise a listing while scanning inventory.

## What Changes

- Replace `/app/properties` with a modern CRM-style master-detail workspace that combines a five-card property KPI summary, a single-row filter bar, an image-rich property data grid, and a persistent right-side property detail drawer.
- Keep the existing application shell (left navigation, slate palette, global header) unchanged while applying the card styling, soft status badges, minimal shadows, generous whitespace, structured information hierarchy, and image-enhanced records from `resources/properties-design.json`.
- Use a five-card property KPI summary (Total Listings, Active, Pending, Inactive, and Average List Price) with a representative bucket icon on the left of each card and a month-over-month percentage change indicator (up arrow in green for positive, down arrow in red for negative, neutral indicator when prior-month data is missing) sourced from each property's `created_at`.
- Replace `/app/properties/[propertyId]` as the primary interaction model with deep-linked drawer selection via `/app/properties?property=<id>&tab=<tab>`.
- Redirect existing property detail URLs into the master-detail workspace so shared links still open the selected property context.
- Add a context drawer that opens only when a property is selected, dismisses when the user clicks anywhere outside the drawer (excluding clicks on grid rows that switch selection), and renders a hero image, identity summary, primary/secondary pricing, structured key information, image gallery, timeline, and activity history. Tabs SHALL be Overview, Details, Images, Timeline, and Activity.
- Keep drawer quick actions (primary: Edit Listing, Schedule Viewing; secondary: Mark Status, Share Listing, Delete Listing) accessible directly inside the drawer footer with leading icons; deletion goes through a confirmation and is rejected when the property is linked to active deals.
- Upgrade the property filter bar to a single horizontal row with search (name, owner, city, state, postcode, reference code), status, property type, listing type, location (state, then city), agent (manager-only), date range (All time, Today, This Week, This Month, This Quarter), and Reset.
- Make property images first-class throughout the experience: display a thumbnail in every grid row, a large hero in the drawer with a count indicator, and a gallery tab; show an image count badge on listings with multiple images.
- Introduce a curated set of canonical property types and download one Unsplash stock image per type (via `unsplash-mcp`) to use as the default thumbnail and hero image for any property without an uploaded cover image. Once the user uploads a cover image, the stock fallback is replaced.
- Paginate the property master grid at 20 rows per page with a "Show all" toggle, surface a creation date column, and replace any next-action column with an updated-on column.
- Reuse the existing `/app/properties/new` wizard for editing by accepting an `edit=<property_id>` query parameter that prefills existing values and submits via `PATCH`. Keep `/app/properties/new` as a full-page property creation wizard with the canonical type selector wired in.
- Allow the assigned REN (or a manager) to delete a property and its image records through a backend `DELETE /properties/{property_id}` endpoint that refuses deletion when an active deal references the property.

## Capabilities

### New Capabilities
<!-- None. This change introduces a property-management spec via additions and modifications to existing property behavior. -->

### Modified Capabilities

- `property-management`: Property listing, filtering, detail review, image handling, status changes, and deletion are updated to support a master-detail CRM workspace with first-class property imagery, canonical types, stock-image fallbacks, and deep-linked drawer selection.

## Impact

- **Frontend**: Updates `frontend/src/app/app/properties/page.tsx`, `frontend/src/app/app/properties/[propertyId]/page.tsx`, and `frontend/src/app/app/properties/new/page.tsx`. Adds property workspace components for KPI cards, filter bar, master grid, context drawer, and image gallery; introduces a canonical property-type module and a stock-image fallback resolver.
- **Backend**: Extends `backend/app/routes/properties.py` with structured filters needed by the workspace (creation-date range, paginated list, reference code search), a property-deletion endpoint that rejects deletion when active deals reference the property, and serialization of `cover_image_url` derived from uploaded cover or canonical type fallback.
- **Data model**: No destructive schema changes; canonical property types are introduced as a frontend constant and validated in the backend payload. Each property gains a derived (non-persisted) `cover_image_url` field on read.
- **Assets**: Adds Unsplash stock images keyed by canonical property type to `frontend/public/property-stock/`, sourced through `unsplash-mcp` with attribution recorded in `frontend/public/property-stock/ATTRIBUTIONS.md`.
- **OpenSpec**: Adds the property-management spec delta, implementation design, and task list under `openspec/changes/redesign-properties-workspace/`.
- **Out of scope**: Shell-wide color palette changes, replacing the Add Property wizard with a drawer form, advanced analytics, decorative charts, multi-image upload pipelines beyond the current cover/gallery model, and redesigning unrelated CRM modules.

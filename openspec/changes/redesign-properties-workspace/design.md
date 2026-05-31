## Context

The current Properties experience is split between `/app/properties` (a six-column list with text-only rows), `/app/properties/new` (a single-step form), and `/app/properties/[propertyId]` (a long, scrollable detail page that mixes a status selector, an inline edit form, and image management). Selecting a listing forces a full page navigation and pulls the user out of the inventory scanning flow they were in.

`resources/properties-design.json` defines a Three-Panel CRM Layout: existing app navigation on the left, a primary property workspace in the center, and a sticky property detail drawer on the right. The application shell already provides the dark navigation and light content area, so this change should preserve the shell and replace the property module content with the master-detail workspace pattern that was just rolled out for Leads (`openspec/changes/redesign-leads-workspace/`).

Property images are central to the new design (`property_image_system.importance: high`) but the current data model only stores user-uploaded images in `property_images`. Many existing rows have no images, which makes the new image-first grid look broken. We need a fallback image strategy that holds up until users upload their own photos.

## Goals / Non-Goals

**Goals:**

- Make `/app/properties` a CRM-style operational workspace where users can browse, filter, select, review, and act on properties without leaving the page.
- Mirror the master-detail architecture and interaction model already established by the Leads workspace so the two modules feel consistent.
- Treat property images as a first-class identification element: thumbnails in every list row, a hero image in the drawer, and an image gallery tab.
- Provide a reliable fallback when a property has no uploaded cover image by serving a curated Unsplash stock photo per canonical property type.
- Replace the separate detail-page interaction model with deep-linked drawer selection via `/app/properties?property=<id>&tab=<tab>`.
- Keep existing detail URLs working by redirecting `/app/properties/[propertyId]` to the workspace with the property selected.
- Reuse `/app/properties/new` for editing via `?edit=<property_id>` and keep it a full-page wizard.

**Non-Goals:**

- Replacing the application shell, sidebar behavior, or global slate color palette.
- Replacing the Add Property wizard with a drawer or modal create form.
- Adding predictive valuation, decorative charts, or advanced analytics to the Properties page.
- Redesigning Leads, Viewings, Campaigns, Deals, or Manager pages.
- Building a multi-image cover-photo selection or reordering UI beyond the existing cover/gallery model.
- Persisting stock fallback images in the database; they are derived at read time only.

## Decisions

### Decision: Use drawer selection as the primary property detail model

`/app/properties` will own property selection state. Selecting a row updates the URL query string to `/app/properties?property=<id>&tab=<tab>` and loads that property's detail data into a right-side floating drawer. The drawer renders a hero image, identity summary, pricing card, key-information card, description block, image gallery, timeline, and activity history across the tabs Overview, Details, Images, Timeline, and Activity. Sticky quick actions live in the drawer footer for Edit Listing, Schedule Viewing, Mark Status, Share Listing, and Delete Listing. The drawer is only rendered when a property is selected and dismisses when the user clicks anywhere outside it (selecting a different row reopens it with the new property).

Alternative considered: keep `/app/properties/[propertyId]` as the full detail surface and use the drawer only as a preview. Rejected because it preserves the navigation-heavy workflow that the redesign is meant to remove and would mean maintaining two competing detail experiences.

### Decision: Reuse the property wizard for editing

To avoid maintaining a parallel form UI, the Edit Listing quick action navigates to `/app/properties/new?edit=<id>`. The wizard loads the existing property via `GET /properties/{id}`, prefills its state, and on submit issues `PATCH /properties/{id}` instead of `POST /properties`. After saving, the wizard returns the user to `/app/properties?property=<id>` so the drawer reflects the edited values.

Alternative considered: build an inline edit panel inside the drawer. Rejected because the wizard already enforces the same validation, listing-type-specific pricing, and structured location capture we want to preserve, and embedding the full form inside the 340-380px drawer would crowd the everyday review surface.

### Decision: Allow deletion of properties without active deals

Deleting a property via `DELETE /properties/{id}` requires that no active deals reference the property (`deals.property_id` foreign key with `ON DELETE RESTRICT`). When safe to delete, the endpoint cascades to `property_images`, removes any `lead_properties` links, and removes the row. If a deal exists, the endpoint returns HTTP 409 with an actionable message and the UI surfaces it as a non-blocking error and keeps the drawer open.

Alternative considered: soft-delete via a `deleted_at` flag. Rejected for now because every other property workflow (listing, RLS, image storage, lead linking) treats properties as active rows; introducing a soft-delete flag would require updating each consumer. We can revisit if compliance ever requires retaining tombstones.

### Decision: Paginate the master grid client-side at 20 rows

The master grid paginates client-side at 20 rows per page with optional "Show all". The list endpoint already returns the team's properties ordered by `updated_at desc`, and the typical team's inventory keeps payloads small. Pagination state is local to the page; filters always reset pagination back to page one. This matches the Leads workspace pattern and avoids needing offset/limit changes in the API contract for this iteration.

Alternative considered: switch to server-side pagination via `limit`/`offset`. Rejected for this iteration because the dataset is small and adding offset to the API contract would require accompanying changes to filter caching and totals.

### Decision: Redirect existing property detail routes into the workspace

`/app/properties/[propertyId]` will redirect to `/app/properties?property=<id>`. This preserves deep links while preventing the application from maintaining two competing detail experiences.

Alternative considered: render the same workspace from both `/app/properties` and `/app/properties/[propertyId]`. Adds route duplication and increases the chance that state, filters, and drawer behavior drift.

### Decision: Ship a five-card KPI row with month-over-month trend

The Properties page will show Total Listings, Active, Pending, Inactive, and Average List Price. The first four are scoped to status; the fifth is a portfolio-wide signal that surfaces inventory pricing without introducing a chart. Each card displays the current value plus a month-over-month percentage change derived from `created_at` (Active/Pending/Inactive use the count of properties created in the current calendar month vs the previous month within that status; Total Listings uses overall counts; Average List Price uses the average of `listing_price` for current month vs previous month, falling back to `expected_rental` for rental-only listings). Positive changes render with an up arrow in green; negative with a down arrow in red; cards with no prior-month data show a neutral indicator. Each card has a representative bucket icon anchored to the left.

Alternative considered: ship a six-card KPI row that includes Average Days on Market. Rejected because the source data for time-on-market is not yet structured for this workspace iteration; we can revisit when the timeline tab is fully wired.

### Decision: Introduce canonical property types and use them for stock-image fallback

The current `properties.type` column is free text, which makes a stock-image lookup brittle. We will introduce a canonical set of property types that the wizard, drawer, and filter bar use:

- `Apartment`
- `Condominium`
- `Bungalow`
- `Terrace House`
- `Semi-Detached`
- `Townhouse`
- `Studio`
- `Penthouse`
- `Villa`
- `Shophouse`
- `Commercial Office`
- `Land`

The `properties.type` column remains a string, but the wizard and filter bar select from this canonical set. Property type filtering on the workspace uses the canonical set; legacy free-text values still display and can be re-categorised through the edit wizard. Each canonical type maps to one Unsplash stock image stored in `frontend/public/property-stock/<slug>.jpg`. The image is downloaded once via `unsplash-mcp` and committed to the repo with attribution recorded in `frontend/public/property-stock/ATTRIBUTIONS.md`. A generic fallback image (`frontend/public/property-stock/default.jpg`) is used for legacy or unrecognised types.

Alternative considered: store a `default_image_url` per property in the database and pre-populate it during a backfill. Rejected because keeping the fallback as a derived view (computed from the type slug) avoids stale URLs and lets us swap stock images by replacing static assets.

### Decision: Derive `cover_image_url` server-side and resolve fallbacks client-side

The property list and detail endpoints will include a `cover_image_url` field. The server returns:

1. The signed URL of the property's `is_cover = true` image, if one exists.
2. Otherwise `null`.

The frontend resolves `cover_image_url ?? stockImageForType(type)` so the workspace always has a usable image source for thumbnails and the drawer hero. This keeps the fallback policy in one place (`frontend/src/lib/property-stock.ts`) and avoids duplicating the image-resolution logic across components. Image count indicators use the existing `images.length` from the detail endpoint and `image_count` from a new lightweight summary on the list endpoint.

Alternative considered: have the server also resolve the stock fallback. Rejected because it couples the API surface to bundled frontend assets and complicates content-delivery for any future mobile or third-party clients.

### Decision: Keep the current slate palette

The module should preserve the current shell palette and Tailwind slate styling. The `properties-design.json` colors guide hierarchy and component intent (soft status badges, white surface, subtle borders) but shell-wide navy/cyan palette changes are outside this change.

Alternative considered: apply the strict `properties-design.json` navigation colors across the application shell. Increases scope and would affect pages outside the Properties redesign.

### Decision: Single horizontal filter bar with no advanced filter button

The filter bar collapses into a single horizontal row with search, status, property type (canonical), listing type, state, city (dependent on state), agent (manager-only), and date range. The reset control stays inline at the end. There is no separate "Advanced filters" panel; if more filters are needed in the future they can be added inline. This matches the Leads workspace decision and keeps the filter bar visible at all times.

Alternative considered: keep the existing free-text city/state inputs. Rejected because the structured Malaysian state and city helpers (`frontend/src/lib/malaysia-areas.ts`) already power the property wizard, and the workspace should reuse them so filter results are deterministic.

## Risks / Trade-offs

- Using free-text `properties.type` while the workspace expects canonical types may produce mismatched filter results for legacy rows. → Show legacy rows in the grid with their original type label, add a "Legacy type" hint in the drawer, and let users normalise via the edit wizard.
- Bundling stock images in the repo increases asset size. → Limit each canonical type to one ~1600px-wide JPG (target < 250 KB) and rely on Next.js image optimisation when serving them.
- Unsplash licensing requires attribution. → Record attribution and source URLs in `frontend/public/property-stock/ATTRIBUTIONS.md`, link to it from the workspace footer caption ("Default photos courtesy of Unsplash"), and avoid using the stock images outside the property fallback context.
- Deriving `cover_image_url` server-side adds an extra query per row on the list endpoint. → Use the existing `property_images` join and project only `is_cover` and `storage_path` to keep the response payload bounded; if performance regresses, add a denormalised `cover_image_path` column later.
- Redirecting `/app/properties/[propertyId]` removes a full detail page users may have become used to. → Preserve links through redirects and ensure the drawer exposes the same data and actions.
- The right drawer can become crowded. → Use tabs (Overview, Details, Images, Timeline, Activity) and stacked cards rather than placing every form in the drawer.

## Migration Plan

1. Add the canonical property-type module and stock-image asset folder; download one Unsplash image per canonical type via `unsplash-mcp` and commit them with attribution.
2. Update the property creation/edit wizard to use the canonical-type selector while still accepting legacy free-text values during the transition.
3. Extend the property list and detail endpoints to include `cover_image_url` and `image_count`.
4. Build the Properties workspace (KPI cards, filter bar, master grid, drawer, gallery tab) at `/app/properties` using the normalized filters and the new fallback resolver.
5. Redirect `/app/properties/[propertyId]` to the workspace selection URL.
6. Add backend `DELETE /properties/{property_id}` with active-deal protection and wire the drawer Delete Listing action through it.
7. Validate that existing property workflows still work: search, status changes, image uploads, gallery management, lead linking, and deal closure.

Rollback strategy: keep `properties.type` free-text intact; the canonical-type module is purely additive and the stock-image fallback only activates when no cover image exists. If the workspace rollout needs to be reverted, the old detail page can continue reading uploaded images directly while canonical types and stock assets remain unused.

## Open Questions

None. Remaining choices are implementation details within the decisions above.

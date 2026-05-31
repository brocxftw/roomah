## 1. Canonical Property Types & Stock Images

- [x] 1.1 Add a canonical property-type module at `frontend/src/lib/property-types.ts` exporting the canonical list (Apartment, Condominium, Bungalow, Terrace House, Semi-Detached, Townhouse, Studio, Penthouse, Villa, Shophouse, Commercial Office, Land), a slug helper, and a label helper.
- [x] 1.2 Use `unsplash-mcp` (`stock_photo` tool with `downloadMode: "urls_only"`) to source one landscape image per canonical type (`min_width: 1600`, target ~1600px wide, < 250KB JPG). Save assets to `frontend/public/property-stock/<slug>.jpg` plus a generic `default.jpg` for legacy/unknown types.
- [x] 1.3 Record Unsplash photographer attribution and source URLs in `frontend/public/property-stock/ATTRIBUTIONS.md` (one entry per image) and link it from the workspace footer caption ("Default photos courtesy of Unsplash").
- [x] 1.4 Add `frontend/src/lib/property-stock.ts` exporting `stockImageForType(type: string): string` that maps a free-text or canonical type to its bundled stock image (with default fallback) and `resolvePropertyImage(property): string` that prefers the uploaded cover and otherwise the stock fallback.
- [x] 1.5 Add a unit test that covers stock-image resolution for canonical types, legacy free-text variants, and unknown types.

## 2. Backend Property API Updates

- [x] 2.1 Update `backend/app/routes/properties.py` list response to include `cover_image_url` (signed URL of `is_cover = true` image, otherwise `null`) and `image_count` (total number of property images).
- [x] 2.2 Update the property detail response to include the same `cover_image_url` field derived from the cover image when present.
- [x] 2.3 Add `created_from`/`created_to` query parameters on `GET /properties` to support the workspace date-range filter (Today, This Week, This Month, This Quarter, All time) and keep them inclusive on both ends.
- [x] 2.4 Add a `ren_id` (or `agent_id`) query parameter on `GET /properties` that managers can use to filter by REN; for non-managers, ignore the parameter and continue scoping to the current REN's properties.
- [x] 2.5 Add `DELETE /properties/{property_id}` that:
  - Verifies the requester can access the property (REN-owned or manager on the same team).
  - Returns HTTP 409 with an actionable message when at least one active deal references the property.
  - Otherwise deletes property images, lead_property links, and property timeline events before removing the property row.
- [x] 2.6 Update or add backend tests covering: list response with `cover_image_url`/`image_count`, date-range filtering, manager `ren_id` filtering, REN scoping, delete success, delete with active deal, and delete forbidden for non-owner REN.

## 3. Properties Workspace Data Model

- [x] 3.1 Define frontend property list, property detail, KPI, filter, and drawer state types for the master-detail workspace (mirror `frontend/src/app/app/leads/page.tsx` patterns).
- [x] 3.2 Add property KPI derivation for Total Listings, Active, Pending, Inactive, and Average List Price with month-over-month percentage changes derived from `created_at`. Average List Price falls back to `expected_rental` for rental-only listings.
- [x] 3.3 Add selected property query-string state using `/app/properties?property=<id>&tab=<tab>` and update the page to read/write these params.
- [x] 3.4 Implement property detail loading for the selected drawer property without fetching detail data for every row.

## 4. Master Workspace UI

- [x] 4.1 Build the five-card property KPI summary row with leading icons (Total, Active, Pending, Inactive, Avg List Price) and month-over-month indicators (up arrow green, down arrow red, neutral when no prior data).
- [x] 4.2 Build the single-row filter bar with search, status, canonical property type, listing type, state, dependent city, agent (manager-only), date range, and an inline Reset.
- [x] 4.3 Build the CRM-style master grid with thumbnail (uploaded cover or stock fallback), property identity (name, reference code, secondary location), classification (canonical type and location), listing type and status badges, primary price, owning REN, creation date, and last-updated timestamp.
- [x] 4.4 Render a soft-pill image-count badge over the thumbnail when a property has more than one uploaded image.
- [x] 4.5 Highlight the selected property row and update the selected drawer property when a row is clicked.
- [x] 4.6 Add empty, loading, and error states for the master grid and selected drawer.
- [x] 4.7 Paginate the master grid at 20 rows per page with a Show All toggle that resets when filters change.

## 5. Property Context Drawer

- [x] 5.1 Build the sticky right-side property context drawer (340-380px wide, fixed, dismisses on outside click) with hero image, gallery indicator, and identity summary.
- [x] 5.2 Add the Overview tab with the key information card (two-column key/value), pricing card (horizontal metric cards for primary and secondary price), and description block.
- [x] 5.3 Add the Details tab with owner contact, structured address, listing type, market value, listing price, expected rental, year built, maintenance fee, bedrooms, bathrooms, sqft, parking, furnishing, and reference code.
- [x] 5.4 Add the Images tab with the existing gallery management (set cover, register image, delete image) and a stock-fallback placeholder when no images are uploaded.
- [x] 5.5 Add the Timeline tab with reverse-chronological property events (created, updated, status change, image added, deal linked).
- [x] 5.6 Add the Activity tab with last viewed by, last updated by, last status change, and any linked leads or deals.
- [x] 5.7 Add a sticky-footer quick action row with leading icons for Edit Listing, Schedule Viewing, Mark Status, Share Listing, and Delete Listing.
- [x] 5.8 Preserve responsive behavior by collapsing the drawer into a bottom sheet on mobile and a collapsible overlay on tablet.

## 6. Wizard Edit Mode

- [x] 6.1 Update `frontend/src/app/app/properties/new/page.tsx` to switch the free-text property-type input for a canonical-type selector that accepts a "Custom" override for legacy free-text values.
- [x] 6.2 Extend the wizard to accept `?edit=<property_id>`, prefill via `GET /properties/{id}`, and submit via `PATCH /properties/{property_id}` instead of `POST /properties` when in edit mode.
- [x] 6.3 After save in edit mode, redirect the user to `/app/properties?property=<property_id>` so the drawer reflects the edited values.
- [x] 6.4 Wire the drawer Edit Listing quick action to navigate to `/app/properties/new?edit=<property_id>`.

## 7. Routing and Compatibility

- [x] 7.1 Redirect `/app/properties/[propertyId]` to `/app/properties?property=<propertyId>`.
- [x] 7.2 Ensure existing property links, newly created properties, and shared URLs open the master-detail workspace with the correct selected property and active drawer tab.
- [x] 7.3 Keep `/app/properties/new` as a full-page wizard and preserve the shell's current slate palette.
- [x] 7.4 Wire the drawer Schedule Viewing action to the existing scheduling entry point with the property pre-selected.
- [x] 7.5 Wire the drawer Share Listing action to copy `${origin}/app/properties?property=<id>` to the clipboard with a toast confirmation.
- [x] 7.6 Wire the drawer Delete Listing action to a confirmation dialog and `DELETE /properties/{property_id}`, surfacing the 409 response inline when an active deal blocks deletion.

## 8. Verification

- [x] 8.1 Run frontend lint/type checks for the modified Properties workspace files.
- [x] 8.2 Run backend tests covering property creation, filtering, detail loading, status changes, image management, and deletion.
- [ ] 8.3 Manually verify the primary workflow: filter properties, select a property, review images, mark status, edit listing, share listing, schedule viewing, and stay in the workspace.
- [ ] 8.4 Verify mobile/tablet behavior for the context drawer (bottom sheet on mobile) and filter bar.
- [ ] 8.5 Verify the stock-image fallback by viewing properties without uploaded images for each canonical type and confirming attribution renders in the workspace footer.

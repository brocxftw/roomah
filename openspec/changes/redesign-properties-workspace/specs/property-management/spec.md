## ADDED Requirements

### Requirement: Property operational workspace
The system SHALL provide a CRM-style master-detail Properties workspace at `/app/properties` that combines a property KPI summary, filter bar, image-rich master grid, and a right-side property detail drawer in a single operational screen. The context drawer SHALL only be visible when a property is selected and SHALL dismiss when the user clicks anywhere outside the drawer or selects a different row.

#### Scenario: Open Properties workspace
- **WHEN** a user navigates to `/app/properties`
- **THEN** the system displays the property KPI summary, property filters, and a searchable property grid without an open context drawer until a property is selected

#### Scenario: Select property from grid
- **WHEN** a user selects a property row from the master grid
- **THEN** the system highlights the selected row, updates the URL to include `property=<id>`, and opens the right-side context drawer for that property

#### Scenario: Dismiss drawer on outside click
- **WHEN** a user clicks anywhere outside the open property drawer that is not another property row
- **THEN** the system closes the drawer and clears the selected property from the URL

#### Scenario: Preserve selected property deep link
- **WHEN** a user opens `/app/properties?property=<id>&tab=<tab>` for a property they can access
- **THEN** the system loads the Properties workspace with that property selected and the requested drawer tab active

### Requirement: Property KPI summary
The system SHALL display a concise property KPI summary with exactly five cards: Total Listings, Active, Pending, Inactive, and Average List Price. Each card SHALL display the current value, a representative bucket icon on the left, and a month-over-month percentage change indicator that compares the current calendar month against the previous calendar month for the same scope. Positive changes SHALL render with an upward arrow in a positive color; negative changes SHALL render with a downward arrow in a negative color; cards with no prior-month data SHALL render a neutral indicator.

#### Scenario: Review property KPIs
- **WHEN** a user opens the Properties workspace
- **THEN** the system displays the five property KPI cards above the filter bar with current values and month-over-month change indicators

#### Scenario: KPI shows positive month-over-month change
- **WHEN** the current-month value for a card is greater than the previous-month value for the same card scope
- **THEN** the corresponding KPI card displays the percentage change with an upward arrow in a positive color

#### Scenario: KPI shows negative month-over-month change
- **WHEN** the current-month value for a card is less than the previous-month value for the same card scope
- **THEN** the corresponding KPI card displays the percentage change with a downward arrow in a negative color

#### Scenario: Average list price falls back to expected rental
- **WHEN** the Average List Price card scope contains rental-only properties without `listing_price`
- **THEN** the calculation uses each rental-only property's `expected_rental` so the average reflects all monetised inventory

### Requirement: Property filter bar
The system SHALL provide a single horizontal filter bar above the master grid with search, status, property type (canonical), listing type, state, city, agent (manager-only), date range, and an inline Reset control. Search SHALL match against property name, owner name, owner email, owner phone, city, state, postcode, and reference identifier substrings. The agent filter SHALL be hidden for non-manager roles and SHALL keep results scoped to the current REN. Filter changes SHALL reset master-grid pagination back to the first page.

#### Scenario: Search by property name substring
- **WHEN** a user searches with a property-name substring
- **THEN** the system returns properties whose name contains the substring (case-insensitive)

#### Scenario: Filter by canonical property type
- **WHEN** a user filters by a canonical property type
- **THEN** the system returns only properties whose `type` matches the selected canonical type, including legacy free-text values whose normalised form matches

#### Scenario: Filter by structured location
- **WHEN** a user selects a state and a city
- **THEN** the system returns only properties whose `state` and `city` match the selected values

#### Scenario: Manager filters by agent
- **WHEN** a manager selects an agent in the agent filter
- **THEN** the system returns only properties owned by the selected REN

#### Scenario: REN cannot filter other agents
- **WHEN** an REN opens the property filter bar
- **THEN** the system does not display the agent filter and continues to scope results to that REN's properties

#### Scenario: Filter by creation date range
- **WHEN** a user selects a date range filter (All time, Today, This Week, This Month, This Quarter)
- **THEN** the system displays only properties whose creation date falls within the selected range while preserving other active filters

#### Scenario: Reset filters
- **WHEN** a user activates the Reset control
- **THEN** the system clears all filter selections and the URL filter parameters

### Requirement: Property master grid
The system SHALL render an image-rich master grid that displays each property with a thumbnail image, property name and reference code, classification (canonical type and location), listing type and status badges, primary price, owning REN, creation date, and last-updated timestamp. The grid SHALL paginate at 20 rows per page by default and SHALL offer a Show All toggle that displays all matching rows. The grid SHALL support sticky headers, hover states, and a selected-row state aligned with the right drawer.

#### Scenario: Property thumbnail uses uploaded cover when available
- **WHEN** a property has an uploaded cover image
- **THEN** the master grid renders that cover image as the thumbnail for the property row

#### Scenario: Property thumbnail falls back to canonical-type stock image
- **WHEN** a property has no uploaded cover image and its canonical type maps to a bundled stock image
- **THEN** the master grid renders the stock image for that canonical type as the thumbnail

#### Scenario: Property thumbnail falls back to default placeholder
- **WHEN** a property has no uploaded cover image and its type does not map to a canonical bundled stock image
- **THEN** the master grid renders the generic default placeholder image as the thumbnail

#### Scenario: Paginate property master grid
- **WHEN** the Properties workspace renders more than 20 properties matching the current filters
- **THEN** the system shows the first 20 properties, exposes pagination controls to navigate through pages, and offers a Show All option that displays all matching properties on a single page

#### Scenario: Show timestamps on every row
- **WHEN** the Properties workspace renders the master grid
- **THEN** each row displays the property's creation date and last-updated timestamp instead of a derived next-action label

#### Scenario: Image count badge on multi-image listings
- **WHEN** a property has more than one uploaded image
- **THEN** the master grid thumbnail shows an image-count badge that reflects the total number of uploaded images

### Requirement: Property context drawer
The system SHALL provide a right-side property detail drawer that opens when a property is selected and displays a hero image with a gallery indicator, an identity summary, and tabbed content for Overview, Details, Images, Timeline, and Activity. The drawer SHALL display primary and secondary pricing, structured key information, and a description block, and SHALL surface drawer-level quick actions in a footer below the tab content.

#### Scenario: Drawer hero uses uploaded cover or stock fallback
- **WHEN** the drawer opens for a selected property
- **THEN** the hero renders the uploaded cover image when available, otherwise the canonical-type stock image, otherwise the default placeholder

#### Scenario: Overview tab displays summary cards
- **WHEN** the Overview tab is active
- **THEN** the drawer displays the key information card (two-column key/value), the pricing card (horizontal metrics for primary and secondary price), and the description block

#### Scenario: Details tab displays full attributes
- **WHEN** the Details tab is active
- **THEN** the drawer displays owner contact, structured address, listing type, market value, listing price, expected rental, year built, maintenance fee, bedrooms, bathrooms, sqft, parking, furnishing, and reference code

#### Scenario: Images tab displays gallery
- **WHEN** the Images tab is active
- **THEN** the drawer displays each uploaded image with a cover indicator and an action to set any non-cover image as cover, falling back to the canonical-type stock image if no images are uploaded

#### Scenario: Timeline tab shows reverse-chronological events
- **WHEN** the Timeline tab is active
- **THEN** the drawer displays property timeline events (created, updated, status change, image added, deal linked) in reverse chronological order

#### Scenario: Activity tab shows recent updates
- **WHEN** the Activity tab is active
- **THEN** the drawer displays recent activity for the property, including last viewed by, last updated by, last status change, and any linked leads or deals

### Requirement: Property drawer quick actions
The system SHALL surface, from the property context drawer footer, quick actions for Edit Listing, Schedule Viewing, Mark Status, Share Listing, and Delete Listing. Each action button SHALL display an icon on its leading edge to communicate the action's intent.

#### Scenario: Edit Listing reuses the wizard
- **WHEN** a user activates the Edit Listing quick action
- **THEN** the system opens the property wizard prefilled with the selected property's data and submits subsequent changes via `PATCH /properties/{property_id}`

#### Scenario: Schedule Viewing pre-selects the property
- **WHEN** a user activates the Schedule Viewing quick action
- **THEN** the system opens the viewing scheduler with the selected property pre-filled

#### Scenario: Mark Status updates the listing status inline
- **WHEN** a user selects a new status from the Mark Status action
- **THEN** the system updates the property status via `PATCH /properties/{property_id}` and refreshes the drawer without leaving the workspace

#### Scenario: Share Listing copies a deep link
- **WHEN** a user activates the Share Listing quick action
- **THEN** the system copies the workspace deep link `/app/properties?property=<id>` to the clipboard

#### Scenario: Delete Listing removes the property
- **WHEN** an REN activates the Delete Listing quick action for a property without any active deals and confirms the deletion
- **THEN** the system deletes the property, its property images, lead-property links, and timeline events, and closes the drawer

#### Scenario: Delete Listing with active deal is rejected
- **WHEN** a user activates the Delete Listing quick action for a property with at least one active deal
- **THEN** the system rejects the request and surfaces an error explaining that properties linked to active deals cannot be deleted

### Requirement: Canonical property types
The system SHALL provide a canonical set of property types used by the property creation/edit wizard, the master grid filters, and the stock-image fallback resolver. Canonical types SHALL include Apartment, Condominium, Bungalow, Terrace House, Semi-Detached, Townhouse, Studio, Penthouse, Villa, Shophouse, Commercial Office, and Land. Legacy free-text type values SHALL still display in the grid with their original label and SHALL remain editable through the wizard.

#### Scenario: Wizard exposes canonical types
- **WHEN** a user selects a property type in the create or edit wizard
- **THEN** the wizard offers the canonical property-type list as the primary selection

#### Scenario: Filter bar exposes canonical types
- **WHEN** a user opens the property type filter
- **THEN** the filter bar offers the canonical property-type list as selectable options

#### Scenario: Legacy type retained on read
- **WHEN** a property has a legacy free-text type value
- **THEN** the system displays the original value in the master grid and drawer and does not overwrite the value until the user edits the property

### Requirement: Property stock image fallback
The system SHALL maintain a curated set of bundled Unsplash stock images keyed by canonical property type and SHALL serve them as the default cover image whenever a property has no uploaded cover image. The system SHALL record image attribution in a static attributions file and SHALL serve a generic default placeholder for any type that does not map to a canonical entry.

#### Scenario: Stock image bundled per canonical type
- **WHEN** a developer adds a new canonical property type
- **THEN** the system requires a corresponding bundled stock image and attribution entry before the type can be used in production

#### Scenario: Stock image used when no cover uploaded
- **WHEN** a property record has no `is_cover = true` image and its canonical type maps to a bundled stock image
- **THEN** the workspace serves the bundled stock image for that type wherever a cover image would otherwise appear

#### Scenario: Default placeholder when type not mapped
- **WHEN** a property record has no `is_cover = true` image and its type does not map to a canonical bundled image
- **THEN** the workspace serves the generic default placeholder for that property

#### Scenario: User upload replaces stock fallback
- **WHEN** a user uploads a new image and marks it as the cover
- **THEN** the workspace stops serving the stock fallback for that property and serves the user-uploaded cover image in all contexts

### Requirement: Property cover image resolution
The system SHALL include a derived `cover_image_url` field on the property list and detail responses that returns the signed URL of the property's `is_cover = true` image when available, otherwise `null`. The frontend SHALL resolve a final image source by using `cover_image_url` when present and otherwise the canonical-type stock image (or default placeholder) for that property. The list response SHALL also include an `image_count` integer for use by the master grid badge.

#### Scenario: List response includes cover image and image count
- **WHEN** the list endpoint returns a property
- **THEN** the response includes `cover_image_url` and `image_count` fields for that property

#### Scenario: Detail response includes cover image url
- **WHEN** the detail endpoint returns a property
- **THEN** the response includes `cover_image_url` derived from the property's cover image (or `null` when no cover image exists)

### Requirement: Property delete endpoint
The system SHALL expose `DELETE /properties/{property_id}` that an REN (or a manager on the same team) MAY use to remove a property they can access. The endpoint SHALL refuse deletion when at least one active deal references the property and SHALL otherwise cascade through `property_images`, `lead_properties`, and property timeline events before removing the property row.

#### Scenario: REN deletes property without active deals
- **WHEN** an REN issues `DELETE /properties/{property_id}` for a property they own that has no active deals
- **THEN** the system deletes the property and its dependent rows and returns HTTP 204

#### Scenario: Delete rejected for property with active deal
- **WHEN** any user issues `DELETE /properties/{property_id}` for a property linked to at least one active deal
- **THEN** the system returns HTTP 409 with a message explaining that properties with active deals cannot be deleted

#### Scenario: Manager deletes team property
- **WHEN** a manager issues `DELETE /properties/{property_id}` for a team property without active deals
- **THEN** the system deletes the property and its dependent rows and returns HTTP 204

#### Scenario: REN cannot delete other REN's property
- **WHEN** an REN issues `DELETE /properties/{property_id}` for a property they do not own
- **THEN** the system returns HTTP 404

## MODIFIED Requirements

### Requirement: Property detail view

The system SHALL provide property detail review inside the `/app/properties` context drawer. The drawer SHALL display owner contact, structured address, classification, listing type and status, primary and secondary pricing, structured key information, description, image gallery, timeline events, and activity history, and SHALL surface quick actions for Edit Listing, Schedule Viewing, Mark Status, Share Listing, and Delete Listing. The property master grid SHALL display creation and last-updated timestamps for each row, paginate at 20 rows per page by default, and allow the user to display all rows. Existing `/app/properties/[propertyId]` URLs SHALL redirect to `/app/properties?property=<id>`.

#### Scenario: Open a property detail drawer

- **WHEN** an REN selects a property they can access from the Properties workspace
- **THEN** the drawer displays owner info, address, classification, status, listing type, pricing, attributes, image gallery, timeline events in reverse chronological order, and activity history

#### Scenario: Open existing property detail URL

- **WHEN** a user navigates to `/app/properties/[propertyId]` for a property they can access
- **THEN** the system redirects to `/app/properties?property=<propertyId>` and opens the Properties workspace with that property selected

#### Scenario: Update property status from drawer

- **WHEN** a user changes the property status from the drawer Mark Status action
- **THEN** the system updates the property status and refreshes the selected property context without navigating away from the Properties workspace

#### Scenario: Manage gallery from drawer

- **WHEN** a user uploads or sets a cover image from the drawer Images tab
- **THEN** the system updates the property's images and refreshes the drawer hero, gallery, and master grid thumbnail without navigating away from the Properties workspace

#### Scenario: Paginate property master grid

- **WHEN** the Properties workspace renders more than 20 properties matching the current filters
- **THEN** the system shows the first 20 properties, exposes pagination controls to navigate through pages, and offers an option to show all matching properties on a single page

#### Scenario: Property master grid shows timestamps

- **WHEN** the Properties workspace renders the master grid
- **THEN** each row displays the property's creation date and last-updated timestamp

### Requirement: Property creation via wizard

The system SHALL provide a wizard to create a property capturing identity, owner contact, address, classification, listing type and pricing, and a review step. On creation the system SHALL assign a `property_id`, set `status = Active`, set ownership to the current REN, set `team_id` to the user's team, store the canonical property type when one is selected, and emit a `property_created` timeline event.

#### Scenario: Successful property creation

- **WHEN** an REN completes the wizard and confirms the Review step
- **THEN** the system creates a `properties` row with `status = Active`, sets `ren_id` to the current user, sets `team_id` to the user's team, stores the selected canonical type, and emits a `property_created` timeline event

#### Scenario: Required fields enforced

- **WHEN** the REN attempts to advance past the identity step without entering property name, owner name, owner phone, or owner email
- **THEN** the system blocks the transition and surfaces an inline validation error per missing field

#### Scenario: Listing-type pricing validation

- **WHEN** the REN selects `Sale` and submits without a `listing_price`, or selects `Rental` and submits without an `expected_rental`
- **THEN** the system blocks submission and surfaces a validation error explaining the required pricing field

#### Scenario: Canonical type selection

- **WHEN** the REN reaches the classification step
- **THEN** the system provides the canonical property-type list as the primary selector and accepts the chosen value as `properties.type`

#### Scenario: Edit reuses the wizard

- **WHEN** a user opens `/app/properties/new?edit=<property_id>` for a property they can access
- **THEN** the wizard prefills the existing property values, accepts edits to all fields, submits via `PATCH /properties/{property_id}`, and returns the user to `/app/properties?property=<property_id>` after a successful save

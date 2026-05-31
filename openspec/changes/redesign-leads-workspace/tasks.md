## 1. Lead Location Normalization

- [x] 1.1 Add structured preferred-location fields for leads while retaining the existing `preferred_location` field.
- [x] 1.2 Add a migration/backfill step that maps high-confidence Malaysian state, city, and area values from existing free-text lead preferences.
- [x] 1.3 Update backend lead create and update payload models to accept structured preferred state, city, and area values.
- [x] 1.4 Update the lead list endpoint to support structured state and city filter parameters.
- [x] 1.5 Add or update backend tests for structured lead location creation, updates, filtering, and free-text retention.

## 2. Lead Wizard Updates

- [x] 2.1 Replace the Add Lead wizard preference free-text-only location input with structured state, city, and area controls.
- [x] 2.2 Preserve optional free-text preferred-location notes where existing data or user input cannot be normalized.
- [x] 2.3 Update the wizard review step to show structured location preferences clearly.
- [x] 2.4 Ensure newly created leads still redirect into a valid lead context after creation.

## 3. Leads Workspace Data Model

- [x] 3.1 Define frontend lead list, lead detail, KPI, filter, and drawer state types for the master-detail workspace.
- [x] 3.2 Add lead KPI derivation for Active Leads, New Leads, Overdue Follow-ups, and Conversion Rate.
- [x] 3.3 Add selected lead query-string state using `/app/leads?lead=<id>&tab=<tab>`.
- [x] 3.4 Implement lead detail loading for the selected drawer lead without fetching detail data for every row.

## 4. Master Workspace UI

- [x] 4.1 Build the four-card lead KPI summary row.
- [x] 4.2 Build the filter bar with search, status, source, manager-only owner, structured state/city filters, advanced filter affordance, and reset.
- [x] 4.3 Build the CRM-style master grid with identity, contact, classification, status, and next-action columns.
- [x] 4.4 Highlight the selected lead row and update the selected drawer lead when a row is clicked.
- [x] 4.5 Add empty, loading, and error states for the master grid and selected drawer.

## 5. Lead Context Drawer

- [x] 5.1 Build the sticky right-side lead context drawer with entity summary and visible quick actions.
- [x] 5.2 Add the Details tab with customer data, structured preferences, status, REN owner, and campaign attribution.
- [x] 5.3 Add the Timeline tab with reverse-chronological events and inline manual interaction logging.
- [x] 5.4 Add the Properties tab with active linked properties and property-linking controls.
- [x] 5.5 Add upcoming lead work in the drawer using available follow-up and viewing context.
- [x] 5.6 Preserve responsive behavior by collapsing the drawer into an overlay on smaller screens.

## 6. Close Deal Modal

- [x] 6.1 Extract the existing close-deal workflow into a reusable modal launched from the drawer quick actions.
- [x] 6.2 Restrict the modal property picker to active properties linked to the selected lead.
- [x] 6.3 Preserve existing sale/rental listing type behavior and fee override fields.
- [x] 6.4 Refresh the selected lead context after successful deal creation without leaving the Leads workspace.

## 7. Routing and Compatibility

- [x] 7.1 Redirect `/app/leads/[leadId]` to `/app/leads?lead=<leadId>`.
- [x] 7.2 Ensure existing lead links, newly created leads, and shared URLs open the master-detail workspace with the correct selected lead.
- [x] 7.3 Keep `/app/leads/new` as a full-page wizard and preserve the shell's current slate palette.

## 8. Verification

- [x] 8.1 Run frontend lint/type checks for the modified Leads workspace files.
- [x] 8.2 Run backend tests covering lead creation, filtering, detail loading, property linking, timeline logging, and deal closure.
- [ ] 8.3 Manually verify the primary workflow: filter leads, select a lead, log an interaction, link a property, close a deal, and stay in the workspace.
- [ ] 8.4 Verify mobile/tablet behavior for the context drawer and filter bar.

## 9. Iteration: Five-Card KPIs, Filter Bar, and Drawer Dismissal

- [x] 9.1 Replace the four KPI cards with five cards (Total, New, Active, Closed, Lost) and compute month-over-month percentage change from `created_at` per bucket.
- [x] 9.2 Render an up arrow in green for positive changes, a down arrow in red for negative changes, and a neutral indicator when prior-month data is missing.
- [x] 9.3 Remove the Advanced filter button and add a date-range filter (All time, Today, This Week, This Month, This Quarter) that filters the master grid client-side by `created_at`.
- [x] 9.4 Rename the manager-only owner filter label to "All agents" and confirm it remains hidden for non-manager roles.
- [x] 9.5 Make the lead context drawer render only when a lead is selected and dismiss when the user clicks outside the drawer (excluding clicks on lead grid rows that switch selection).
- [x] 9.6 Re-run frontend lint and typecheck after the iteration changes.

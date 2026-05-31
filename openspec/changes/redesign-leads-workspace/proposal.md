## Why

The current Leads page is a navigation-heavy list that sends users to a separate detail page for nearly every meaningful action. This conflicts with the CRM workspace direction defined in `resources/leads-design.json`, where users should browse, filter, select, review, and act on leads from a single operational surface.

## What Changes

- Replace the current `/app/leads` list with a modern CRM-style master-detail workspace using KPI cards, a filter bar, searchable lead grid, and persistent right-side context drawer.
- Keep the left application navigation and overall slate palette unchanged while applying the card-based spacing, status badges, hierarchy, and operational layout from `resources/leads-design.json`.
- Use a five-card lead KPI summary for Total Leads, New, Active, Closed, and Lost, with a month-over-month percentage change indicator on each card (up arrow in green for positive change, down arrow in red for negative change) and a representative bucket icon on the left of each card; overlap with dashboard KPIs is intentional where both surfaces need the same signal.
- Replace `/app/leads/[leadId]` as the primary interaction model with deep-linked drawer selection via `/app/leads?lead=<id>&tab=<tab>`.
- Redirect existing lead detail URLs into the master-detail workspace so shared links still open the selected lead context.
- Add a context drawer that opens only when a lead is selected, dismisses when the user clicks outside the drawer, and dynamically displays lead summary, structured preferences, campaign attribution, linked properties, timeline with inline interaction logging, upcoming lead work, and quick actions including WhatsApp messaging, email, schedule viewing, close deal, edit lead details, and delete lead. Each linked property exposes inline unlink and change controls.
- Move Close Deal into a focused modal launched from the drawer quick actions while keeping the current deal creation behavior.
- Normalize lead preferred location before enabling the location filter by adding structured state/city/area fields, backfilling existing free-text preferences, and updating lead create/update workflows.
- Upgrade the lead filter bar to a single horizontal row with search, status, source, date range, manager-only agent filtering, structured state filtering, and reset.
- Keep `/app/leads/new` as a full-page lead creation wizard, updated to collect structured location preferences instead of only free-text preferred location.
- Paginate the lead master grid at 20 rows per page with a "Show all" option, surface a creation date column, and replace the next-action column with an updated-on column.
- Allow the assigned REN (or a manager) to delete a lead and its attributions through a backend `DELETE /leads/{lead_id}` endpoint that refuses deletion when a deal already exists.
- Reuse the lead wizard for editing by accepting an `edit=<lead_id>` query parameter that prefills existing values and submits via `PATCH`.

## Capabilities

### New Capabilities
<!-- None. This changes the existing lead-management capability. -->

### Modified Capabilities
- `lead-management`: Lead listing, filtering, detail review, timeline logging, property linking, deal closure, and preferred-location capture are updated to support a master-detail CRM workspace with structured location filtering.

## Impact

- **Frontend**: Updates `frontend/src/app/app/leads/page.tsx`, `frontend/src/app/app/leads/[leadId]/page.tsx`, `frontend/src/app/app/leads/new/page.tsx`, and likely introduces lead workspace components for KPI cards, filters, master grid, context drawer, and Close Deal modal.
- **Backend**: Updates lead create/update/list schemas and routes in `backend/app/routes/leads.py` to support structured location fields, state/city filtering, and lead deletion.
- **Data model**: Adds structured preferred-location fields for leads and backfills existing `preferred_location` values where possible while retaining the existing free-text field for compatibility and notes.
- **OpenSpec**: Adds a lead-management spec delta, implementation design, and task list under `openspec/changes/redesign-leads-workspace/`.
- **Out of scope**: Shell-wide color palette changes, replacing the Add Lead wizard with a drawer form, advanced analytics, decorative charts, and redesigning unrelated CRM modules.

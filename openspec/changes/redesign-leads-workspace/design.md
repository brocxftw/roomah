## Context

The current Leads experience is split between `/app/leads`, `/app/leads/new`, and `/app/leads/[leadId]`. The list page supports search and status filtering, but each lead row navigates away to a full detail page for review, campaign edits, property linking, timeline logging, and deal closure. This creates unnecessary page transitions for daily CRM work.

`resources/leads-design.json` defines a three-panel CRM workspace: existing app navigation on the left, a primary list workspace in the center, and a sticky context drawer on the right. The application shell already provides the dark navigation and light content area, so this change should preserve the shell and focus on replacing the lead module content.

The location filter is intentionally blocked on lead preferred-location normalization. Leads currently store `preferred_location` as free text, which is not reliable enough for a structured state/city filter. Properties already use structured city/state data and `frontend/src/lib/malaysia-areas.ts` provides Malaysian state and city helper patterns that can guide the lead wizard update and migration heuristics.

## Goals / Non-Goals

**Goals:**

- Make `/app/leads` a CRM-style operational workspace where users can browse, filter, select, review, and act on leads without leaving the page.
- Keep the layout aligned with `resources/leads-design.json`: KPI row, filter bar, master grid, right-side context drawer, soft badges, cards, and visible actions.
- Use five lead KPI cards (Total, New, Active, Closed, Lost) with a month-over-month percentage change indicator on each card.
- Replace the separate detail-page interaction model with deep-linked drawer selection via `/app/leads?lead=<id>&tab=<tab>`.
- Keep existing detail URLs working by redirecting `/app/leads/[leadId]` to the workspace with the lead selected.
- Normalize lead preferred location before shipping the state/city location filter.
- Keep the Add Lead wizard as a full-page flow, but update its preference step to collect structured location data.
- Move Close Deal into a focused modal launched from the context drawer.

**Non-Goals:**

- Replacing the application shell, sidebar behavior, or global slate color palette.
- Replacing the Add Lead wizard with a drawer or modal create form.
- Adding predictive lead scoring, decorative charts, or advanced analytics to the Leads page.
- Redesigning Properties, Viewings, Campaigns, Deals, or Manager pages.
- Solving territory management or multi-area matching beyond structured lead preferences needed for filtering.

## Decisions

### Decision: Use drawer selection as the primary lead detail model

`/app/leads` will own lead selection state. Selecting a row updates the URL query string to `/app/leads?lead=<id>&tab=<tab>` and loads that lead's detail data into a right-side floating drawer. The drawer contains the lead summary, tabs for Details, Timeline, and Properties, and sticky quick actions for WhatsApp, email, schedule viewing, edit lead, close deal, and delete lead. The drawer is only rendered when a lead is selected and dismisses when the user clicks anywhere outside it (selecting a different row reopens it with the new lead).

Alternative considered: keep `/app/leads/[leadId]` as the full detail surface and use the drawer only as a preview. This preserves the existing route but keeps the navigation-heavy workflow that the redesign is meant to remove.

### Decision: Reuse the lead wizard for editing

To avoid maintaining a parallel form UI, the Edit Lead quick action navigates to `/app/leads/new?edit=<id>`. The wizard loads the existing lead via `GET /leads/{id}`, prefills its state, and on submit issues `PATCH /leads/{id}` instead of `POST /leads`. After saving, the wizard returns the user to `/app/leads?lead=<id>` so the drawer reflects the edited values.

Alternative considered: build an inline edit panel inside the drawer. Rejected because the wizard already enforces the same validation, structured location capture, and step layout we want to preserve.

### Decision: Allow deletion of leads without deals

Deleting a lead via `DELETE /leads/{id}` requires that the lead has no closed deals (FK from `deals.lead_id` is `ON DELETE RESTRICT`). When the lead is safe to delete, the endpoint decrements campaign counters for any active attribution and removes the row, cascading to `lead_properties`, `viewings`, and `timeline_events`. If a deal exists, the endpoint returns HTTP 409 with an actionable message and the UI surfaces it as a non-blocking error.

Alternative considered: soft-delete via a `deleted_at` flag. Rejected for now because every other lead workflow (timeline, RLS, counters) treats leads as active rows; introducing a soft-delete flag would require updating each consumer. We can revisit if compliance ever requires retaining tombstones.

### Decision: Paginate the master grid client-side at 20 rows

The master grid paginates client-side at 20 rows per page with optional "Show all". The list endpoint already returns the team's leads ordered by `updated_at desc`, and the typical team size keeps payloads small. Pagination state is local to the page; filters always reset pagination back to page one.

Alternative considered: switch to server-side pagination via `limit`/`offset`. Rejected for this iteration because the dataset is small and adding offset to the API contract would require accompanying changes to filter caching and totals.

### Decision: Redirect existing lead detail routes into the workspace

`/app/leads/[leadId]` will redirect to `/app/leads?lead=<id>`. This preserves deep links while preventing the application from maintaining two competing detail experiences.

Alternative considered: render the same workspace from both `/app/leads` and `/app/leads/[leadId]`. This adds route duplication and increases the chance that state, filters, and drawer behavior drift.

### Decision: Keep Close Deal in a modal launched from the drawer

Close Deal is a focused workflow with property selection, listing type, sale or rental amount, optional fee overrides, and validation. It should open as a modal from the drawer quick actions instead of being embedded directly in the drawer.

Alternative considered: place the full Close Deal form inside the drawer. This would crowd the 320-360px drawer and make everyday review tasks harder to scan.

### Decision: Keep one Timeline tab with inline interaction logging

The drawer will not have a separate Notes tab. Manual calls, notes, and callbacks are timeline events, so the Timeline tab will include an inline write box and display the reverse-chronological event list.

Alternative considered: split Notes and Timeline into separate tabs. This creates an artificial distinction in the UI even though notes are persisted through the timeline system.

### Decision: Ship a five-card KPI row with month-over-month trend

The Leads page will show Total Leads, New, Active, Closed (Won), and Lost. Each card displays the current count plus a month-over-month percentage change derived from `created_at` (leads created in the current calendar month vs leads created in the previous calendar month, scoped to the same status bucket). Positive changes render with an up arrow in green; negative changes render with a down arrow in red; cards with no prior-month data show a neutral indicator.

Alternative considered: keep a four-card layout focused on operational signals (Active, New, Overdue, Conversion). The team chose the bucketed status view because it directly mirrors the lead lifecycle and pairs cleanly with month-over-month comparisons.

### Decision: Block the redesigned location filter on structured lead location data

The filter bar will include structured state and city filters only after leads support normalized preferred-location fields. The migration should retain the existing `preferred_location` value for compatibility and notes while adding structured fields such as `preferred_state`, `preferred_city`, and `preferred_areas`.

Alternative considered: ship a free-text location filter first and normalize later. This would make the new filter feel unreliable and would undermine the CRM-style filtering model.

### Decision: Keep the current slate palette

The module should preserve the current shell palette and Tailwind slate styling. The `leads-design.json` colors guide hierarchy and component intent, but shell-wide navy/cyan palette changes are outside this change.

Alternative considered: apply the strict `leads-design.json` navigation colors across the application shell. This increases scope and would affect pages outside the Leads redesign.

## Risks / Trade-offs

- Structured location migration may not confidently map every free-text `preferred_location` value -> Retain the original free-text field, backfill only high-confidence matches, and leave unmapped rows editable in the updated wizard/drawer.
- Blocking the UI redesign on location normalization increases the change size -> Keep the migration narrowly scoped to lead preferred-location fields and filter behavior.
- Client-side `next_action` calculation from `last_interaction_at` can drift from backend follow-up logic -> Reuse the same two-day follow-up rule from the existing lead-management spec and avoid adding next-viewing logic until the API explicitly supports it.
- Redirecting `/app/leads/[leadId]` removes a full detail page users may have become used to -> Preserve links through redirects and ensure the selected drawer exposes the same actions.
- The right drawer can become crowded -> Use tabs, stacked cards, and a modal for heavy workflows instead of placing every form in the drawer.

## Migration Plan

1. Add structured preferred-location fields to leads while retaining `preferred_location`.
2. Backfill structured fields from existing free-text values using Malaysian state names and known area aliases where confidence is high.
3. Update lead create/update API models and list filters to read and write structured location fields.
4. Update the Add Lead wizard preference step to collect structured state/city/area data and preserve optional free-text notes.
5. Build the Leads workspace using the normalized filters, master grid, drawer, and Close Deal modal.
6. Redirect `/app/leads/[leadId]` to the workspace selection URL.
7. Validate that existing lead workflows still work: search, status changes, campaign edits, property linking, timeline logging, and deal closure.

Rollback strategy: keep `preferred_location` intact and avoid destructive data migration. If the workspace rollout needs to be reverted, the old detail page can continue reading the original free-text field while structured columns remain unused.

## Open Questions

None. The remaining choices are implementation details within the decisions above.

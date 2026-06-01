## Why

The current Viewings page is a simple list with inline completion prompts, so it does not match the ROOMAH master-detail workspace pattern already established by Leads, Properties, and Campaigns. Agents need a scheduling and follow-up command centre that keeps daily appointments, customer interest, follow-up work, and conversion actions visible on one operational screen.

## What Changes

- Replace `/app/viewings` with a ROOMAH master-detail operations workspace: five KPI cards, integrated calendar and agenda workspace, single-row advanced filters, viewings table, and persistent right-side viewing detail drawer.
- Make the calendar and agenda the primary operational surface, with month, week, and day views, date navigation, current-day highlighting, event density, status markers, and empty-slot scheduling affordances.
- Add deep-linked viewing selection through `/app/viewings?viewing=<id>&tab=<tab>` and preserve selected calendar date/view in query state where useful.
- Hydrate viewing records with lead, property, assigned agent, interest, notes, follow-up, and conversion context so the table, agenda, and drawer do not depend on raw IDs.
- Persist viewing follow-ups as first-class workflow state using `follow_up_at` and `follow_up_status`, backfilling existing completed viewings from `completed_at + 2 days`.
- Add cancellation reason tracking while keeping the viewing status model simple. Cancelled viewings can capture reasons such as `lead_cancelled`, `agent_cancelled`, `no_show`, and `other`; the Cancelled / No-show KPI uses this reason data.
- Add reschedule and cancel API behavior in addition to the existing schedule, reassign, and complete flows.
- Extract the Leads close-deal modal into a reusable in-place conversion component and open it directly from the viewing drawer, prefilled with the viewing's lead and property.
- Extend the customer interest model from a 1-3 scale to a 1-5 scale (Not Interested → Ready to Buy) and make the interest card in the drawer directly editable via a 5-star picker, persisted through a dedicated `PATCH /viewings/{id}/interest` endpoint so agents can refine the rating after completion without reopening the completion form. Compact 5-star renderings are used in agenda/table rows and a highlighted interest card in the drawer.
- Add Cancel and No-show quick-action buttons to the drawer footer that immediately cancel the viewing (after confirmation) with reasons `lead_cancelled` and `no_show` respectively, while preserving the Activity tab form for cancellations that need a custom reason and notes.
- Reuse `/app/viewings/new` for edit/reschedule entry points with prefilled date/time from calendar slot interactions.
- Keep the experience operational and CRM-focused: no separate detail pages, no report-heavy dashboard, and no large analytics charts.

## Capabilities

### New Capabilities
- `viewing-operations`: Viewing scheduling workspace behavior, calendar/agenda interaction, master-detail selection, table discovery, drawer actions, cancellation, rescheduling, interest visibility, and conversion entry points.
- `viewing-follow-ups`: Persisted viewing follow-up recommendations, statuses, visibility rules, due/overdue behavior, and follow-up completion/rescheduling workflow.

### Modified Capabilities
<!-- None. The current viewing scheduling requirements exist only in an active `roomah-mvp` change, not under archived `openspec/specs/`. This proposal introduces the durable viewing capabilities for the redesigned workspace. -->

## Impact

- **Frontend**: Updates `frontend/src/app/app/viewings/page.tsx` and `frontend/src/app/app/viewings/new/page.tsx`; likely adds shared workspace/calendar/drawer helpers and extracts the Leads close-deal modal into a reusable component.
- **Frontend routing**: Adds `/app/viewings?viewing=<id>&tab=<tab>` selection behavior plus calendar date/view query state and prefilled schedule/edit query modes.
- **Backend**: Extends `backend/app/routes/viewings.py` with hydrated list/detail responses, follow-up persistence behavior, cancel and reschedule endpoints, and updated complete-viewing behavior.
- **Data model**: Adds persisted follow-up columns and cancellation reason metadata to `viewings`; backfills follow-up dates for existing completed viewings.
- **OpenSpec**: Adds specs for `viewing-operations` and `viewing-follow-ups`, plus design and task artifacts under `openspec/changes/redesign-viewings-workspace/`.
- **Out of scope**: Drag-to-reschedule, multi-day calendar events, external calendar sync, notification delivery, standalone viewing detail pages, and heavy analytics/reporting dashboards.

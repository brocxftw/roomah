## Context

The existing `/app/viewings` page renders a basic list of viewings, shows raw lead/property IDs, and only supports completion once a scheduled viewing is in the past. It does not have the master-detail route selection, KPI cards, filter controls, right-side drawer, or operational table patterns already present in the Leads, Properties, and Campaigns modules.

The current backend supports creating, listing, completing, reassigning, and updating assigned REN only. The `viewings` table already stores `interest_level`, `notes`, `completed_at`, and `status`, but follow-up recommendations are only returned transiently from the completion endpoint. The enum already includes `cancelled`, but there is no cancel endpoint or reason metadata.

`resources/viewings-design.json` defines a calendar-first, scheduling and follow-up workspace where agents can plan daily work, execute appointments, capture outcomes, follow up, and convert opportunities without page navigation.

## Goals / Non-Goals

**Goals:**

- Bring Viewings into the same ROOMAH master-detail workspace family as Leads, Properties, and Campaigns.
- Make the calendar and agenda the primary daily execution surface, with month, week, and day views available in v1.
- Keep customer interest and follow-up recommendations visible across KPI cards, calendar agenda, table rows, and the drawer.
- Persist follow-up recommendations and state so due/overdue work is durable and filterable.
- Support cancellation reason tracking, including no-show reasons, without adding a separate `no_show` status.
- Let agents reschedule, cancel, complete, follow up, and convert from the viewing workflow.
- Reuse and extract existing lead-to-deal conversion behavior so Viewings can open an in-place conversion modal.

**Non-Goals:**

- Drag-to-reschedule calendar behavior.
- Multi-day calendar events.
- External calendar synchronization or notification delivery.
- Standalone viewing detail pages.
- Large analytics charts or report-heavy dashboards.

## Decisions

### Persist follow-ups as workflow state

Add `follow_up_at` and `follow_up_status` to `viewings`. Completing a viewing writes `follow_up_at = completed_at + 2 days` and `follow_up_status = pending` by default. Existing completed viewings are backfilled from `completed_at + 2 days`.

Alternatives considered:

- Derive follow-ups from `completed_at` only. This avoids a migration but cannot support marking follow-ups done or rescheduling follow-up recommendations.
- Persist only `follow_up_at`. This supports due/overdue queries but still lacks a durable completion state.

### Track no-shows as cancellation reasons

Keep the existing `status = cancelled` model and add a cancellation reason column with values such as `lead_cancelled`, `agent_cancelled`, `no_show`, and `other`. The Cancelled / No-show KPI counts cancelled viewings and can break out no-show reasons.

Alternatives considered:

- Add `no_show` as a new status. This is semantically direct but requires enum migration and broadens status branching across UI and API code.
- Count all cancellations only. This is simpler but loses the no-show signal requested for the KPI.

### Calendar v1 includes month, week, and day views

Implement a hand-rolled CRM scheduler using existing React, Tailwind, and Lucide dependencies. Month view shows event density and status markers. Week and day views render time-grid slots and viewing cards. The agenda panel remains visible next to the selected date and shows the operational timeline plus due follow-ups.

Alternatives considered:

- Install a calendar library. This may speed rendering but adds styling/integration weight and risks drifting from ROOMAH's existing card system.
- Ship month view only. This is smaller, but the agreed scope is v1 stretch with week and day operational views.

### Keep drawer as the viewing command centre

Selecting from the calendar, agenda, or table updates `/app/viewings?viewing=<id>&tab=<tab>` and opens a persistent right-side drawer. The drawer owns the viewing header, lead summary, property context, agent summary, highlighted interest card, notes, follow-up recommendation, workflow progression, and sticky action footer.

Alternatives considered:

- Use separate viewing detail pages. This conflicts with the workspace pattern and the design spec.
- Use a temporary modal. This loses persistent context and does not align with Leads/Properties/Campaigns.

### Extract conversion into a shared in-place modal

Move the Leads close-deal modal logic into a reusable component that can be opened by the Viewings drawer with lead and property preselected. Successful conversion should refresh the selected viewing context and update conversion progress signals.

Alternatives considered:

- Deep-link to the Leads workspace. This is cheaper but breaks the "single unified workspace" expectation for Viewings.

### Expand the customer interest model from 1-3 to 1-5 and make it editable in the drawer

Widen the `viewings.interest_level` CHECK constraint from `between 1 and 3` to `between 1 and 5` so the customer-interest signal carries enough resolution for nurture decisions (`1 = Not Interested`, `2 = Slightly Interested`, `3 = Interested`, `4 = Very Interested`, `5 = Ready to Buy`). Existing 1-3 ratings remain valid under the wider range, so no data backfill is needed. The completion form, table, agenda, and drawer card all render the new 5-point scale, and the drawer's interest card exposes a clickable 5-star picker. Edits go through a dedicated `PATCH /viewings/{id}/interest` endpoint that accepts `interest_level` (1-5) and optional `notes`, so agents can refine the rating after completion without reopening the completion form.

Alternatives considered:

- Keep the 1-3 backend and only widen the UI. This guarantees no data model change but discards the extra resolution the moment it is captured.
- Reuse `complete_viewing` for updates. This couples post-completion edits to the completion contract and forces the UI to resend notes/timestamps that are not changing.

### Drawer footer Cancel and No-show quick actions

Add Cancel and No-show buttons to the drawer's sticky footer so agents do not need to switch tabs for the two most common cancellation flows. Both buttons reuse the existing `POST /viewings/{id}/cancel` endpoint: Cancel sends `cancellation_reason = lead_cancelled` with no notes, and No-show sends `cancellation_reason = no_show`. Each prompts a confirmation before submitting and is disabled once the viewing is already cancelled. The Activity tab keeps its full cancellation form (renamed "Cancellation Notes") so agents can still capture a custom reason and free-text notes when needed.

Alternatives considered:

- Open a small inline dialog for cancellation. This is more discoverable for notes but slows the common no-show flow that motivated the request.
- Only expose cancellation through the Activity tab. This is what we shipped first, but agents reported it is too hidden for time-pressured operations.

### Reuse the existing viewing scheduler page

Keep `/app/viewings/new` as the full-page scheduling/editing surface. Calendar empty-slot clicks and drawer edit/reschedule actions navigate to it with query parameters for prefilled date/time or edit mode.

Alternatives considered:

- Build an inline drawer scheduler. This would be faster for agents but increases scope and duplicates the existing scheduler.

## Risks / Trade-offs

- Calendar complexity can grow quickly -> Keep v1 interactions to select date/view, click empty slot to prefill the scheduler, and click events to open the drawer. Exclude drag/drop and multi-day events.
- Hydrated viewing responses can become heavy -> Select only fields needed by workspace rows, agenda cards, and drawer summaries; keep large histories behind existing lead timeline APIs where possible.
- Follow-up status could drift from lead follow-up behavior -> Treat viewing follow-ups as recommendations attached to viewing outcomes, while lead timeline events continue to update lead interaction recency.
- Shared conversion modal extraction can regress Leads -> Preserve the existing Leads modal behavior through the shared component first, then integrate Viewings.
- Cancellation reason values may need reporting later -> Store explicit reason values now instead of only free-text notes.

## Migration Plan

1. Add nullable follow-up and cancellation metadata columns to `viewings`.
2. Backfill `follow_up_at = completed_at + interval '2 days'` and `follow_up_status = pending` for completed viewings without a follow-up value.
3. Update backend serialization so existing clients can tolerate the new fields.
4. Update complete-viewing behavior to persist follow-up fields.
5. Add cancel, reschedule, and follow-up update endpoints.
6. Ship frontend workspace behind the existing `/app/viewings` route.
7. If rollback is needed, keep new nullable columns in place and revert frontend/API behavior to ignore them.

## Open Questions

- Should month-view empty-slot scheduling default the time to a business-hour value such as 10:00, or leave time blank in the scheduler?
- Should follow-up completion emit a new lead timeline event, or only update viewing follow-up status in v1?
- Should conversion progress in the drawer be inferred from lead/deal data, or should the viewing record store a direct `converted_deal_id` later?

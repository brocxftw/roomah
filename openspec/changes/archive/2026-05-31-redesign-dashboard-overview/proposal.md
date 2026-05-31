## Why

The current dashboard opens with analytics and duplicates urgent task counts, which conflicts with the product principle that ROOMAH should help RENs manage their day from one operational surface. This change redesigns the dashboard around immediate attention, active work queues, and a concise business summary so users can answer: what needs attention now, what is happening in the pipeline, and how is the business performing.

## What Changes

- Replace the KPI-first dashboard order with the `resources/dashboard-design.json` command-centre pattern: action panel, KPI summary, primary workspace, then pipeline/work queues.
- Replace the duplicate priority-card section with a single top-level Today's Tasks widget that surfaces overdue follow-ups, today's viewings, and deals closing soon.
- Place quick-create actions beside urgent tasks so the most common workflows are available immediately after login.
- Keep the KPI summary concise and secondary to the action panel, with five consistent cards for high-level business performance.
- Promote active work queues into the main workspace: today's appointments, follow-ups requiring action, and recent activity.
- Keep a clean customer-lifecycle pipeline/funnel, but remove decorative or overly analytical supporting panels that do not help daily operational decisions.
- Remove target-editing forms from the dashboard and treat target management as a profile/settings workflow; the dashboard may show only read-only target progress where it directly supports performance awareness.
- Keep the manager oversight page out of scope for this change; this redesign applies to the main `/app` dashboard.

## Capabilities

### New Capabilities

<!-- None. This changes the existing dashboard capability. -->

### Modified Capabilities

- `dashboard`: Update the dashboard requirements from a simple task/KPI ordering rule to an explicit operational command-centre layout with action-first sections, active work queues, concise KPIs, and a pipeline/funnel.

## Impact

- **Frontend**: Updates `frontend/src/app/app/page.tsx` and `frontend/src/components/dashboard/dashboard-widgets.tsx` to rebuild the dashboard layout and widgets around the design-system pattern.
- **Backend**: Uses the existing `GET /dashboard` payload where possible. A small payload adjustment may be needed if the final implementation exposes KPI trend deltas or read-only target progress chips.
- **OpenSpec**: Adds a dashboard spec delta and implementation task list under `openspec/changes/redesign-dashboard-overview/`.
- **Out of scope**: Manager dashboard redesign, full shell color-system overhaul, predictive analytics, decorative charts, and unrelated dashboard scaffold changes.

## Why

The dashboard is the surface a REN sees first on every login, and it should let them answer "what needs attention, what is scheduled, and what opportunities need action" within seconds. The current dashboard already follows an action-first layout, but it is organised around generic task counts and an analytics-leaning pipeline funnel rather than the full lead-to-close operational journey. This change re-organises the dashboard into an action-first operational command centre aligned to `resources/dashboard-design.json`, surfacing follow-ups, today's schedule, hot prospects, property-match opportunities, deals to progress, and personal goal progress so a REN can move through the customer lifecycle without leaving the page.

## What Changes

- Re-organise the dashboard into five ordered sections following the user journey: a KPI health strip, an operational workspace (follow-ups, today's schedule, hot prospects), an opportunity-management section (recommended property matches, deals requiring progression, personal performance vs target), recent activity, and quick actions.
- Add a **Hot Prospects** card that surfaces high-intent leads using a stage-based heuristic (`Proposal` and `Negotiation`), each linking into the lead record.
- Add a **Recommended Property Matches** card using a lightweight signal: in-flight leads that have no active linked property yet ("needs matching"), each linking into the lead so the REN can attach inventory.
- Add a **Deals Requiring Progression** card surfacing negotiation-stage opportunities that need the next step, linking into the deals/leads workspace.
- Add a **Monthly Goal** card showing read-only personal performance against the monthly commission target (and team target where the scope applies).
- Keep a compact, glanceable pipeline funnel as a lifecycle summary; remove no other operational queues.
- Reverse the previously shipped section ordering: place the concise KPI health strip first and quick actions last, per the requested journey. This consciously modifies the prior "action panel appears first" requirement.

## Capabilities

### New Capabilities

<!-- None. This evolves the existing dashboard capability. -->

### Modified Capabilities

- `dashboard`: Re-order the dashboard sections to a journey-first layout (KPI strip, operational workspace, opportunity management, recent activity, quick actions) and add operational workspace, hot prospects, recommended property matches, deals-to-progress, and monthly-goal requirements.

## Impact

- **Frontend**: Updates `frontend/src/app/app/page.tsx` and `frontend/src/components/dashboard/dashboard-widgets.tsx` to re-order sections and add Hot Prospects, Recommended Property Matches, Deals Requiring Progression, and Monthly Goal cards. Adds links into Leads, Properties, Viewings, Deals, Timeline, and Tasks.
- **Backend**: Reuses the existing `GET /dashboard` payload. Hot prospects and deals-to-progress reuse existing in-flight/negotiation lead data; the lightweight property-match signal reuses lead-to-property link status already computed for the funnel, exposed as a small additional payload field (e.g. `tasks.leads_needing_property_match`). No new matching engine is introduced.
- **OpenSpec**: Adds a dashboard spec delta and task list under `openspec/changes/redesign-dashboard-command-centre/`.
- **Out of scope**: A real preference-based property-matching/ranking engine, manager dashboard redesign, predictive analytics, decorative charts, and editable target forms on the dashboard.

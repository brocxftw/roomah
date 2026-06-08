## Why

`redesign-dashboard-command-centre` shipped an action-first dashboard that is structurally close to `resources/dashboard_v2.json`, but three lower-section details still diverge from a strict v2 reading: the opportunity row uses equal columns instead of v2's `40/40/20`, recent activity and quick actions are stacked full-width instead of v2's single `70/30` `activity_and_actions_row`, and a compact lifecycle pipeline funnel sits between them even though v2 has no pipeline row. This change aligns the lower dashboard precisely to `dashboard_v2.json` so the surface stays operational and anti-analytics, with quick actions always visible.

This change sequences after `redesign-dashboard-command-centre` is archived, because it modifies requirements introduced by that change.

## What Changes

- Remove the lifecycle pipeline funnel from the dashboard; `dashboard_v2.json` defines no pipeline row and the surface should stay action-first.
- Apply v2's `40/40/20` ratio to the opportunity-management row (recommended matches and deals requiring progression wide, monthly goal narrow).
- Merge recent activity and quick actions into a single `activity_and_actions_row` at a `70/30` ratio, with quick actions always visible rather than a final stacked section.
- Restyle the lightweight property-match card as recommendation-style cards (no real matching engine, no fabricated match scores); it continues to surface in-flight leads with no active linked property.
- Add v2 per-row affordances to operational cards: urgency/interest indicators and a per-row quick action where it supports the workflow.

## Capabilities

### New Capabilities

<!-- None. This refines the existing dashboard capability. -->

### Modified Capabilities

- `dashboard`: Align the lower dashboard rows to `dashboard_v2.json` (drop pipeline row, `40/40/20` opportunity row, merged `70/30` activity-and-actions row with always-visible quick actions) and add per-row workflow affordances.

## Impact

- **Frontend**: Updates `frontend/src/app/app/page.tsx` to drop the `PipelineFunnel` usage, apply the `40/40/20` and `70/30` grids, and merge activity + actions. Updates `frontend/src/components/dashboard/dashboard-command-centre-widgets.tsx` and `dashboard-widgets.tsx` for recommendation-style match cards and per-row affordances.
- **Backend**: No payload changes; reuses the existing `GET /dashboard` fields (`tasks.leads_needing_property_match`, `tasks.hot_prospects`, etc.).
- **OpenSpec**: Adds a dashboard spec delta and task list under `openspec/changes/align-dashboard-to-v2-layout/`.
- **Depends on**: `redesign-dashboard-command-centre` being archived first so the modified requirements exist in the main dashboard spec.
- **Out of scope**: A real preference-based property-matching/ranking engine with match scores and property thumbnails, manager dashboard, and any new analytics.

## 1. Layout alignment

- [x] 1.1 Remove the `PipelineFunnel` usage from `frontend/src/app/app/page.tsx` (and drop the now-unused import).
- [x] 1.2 Change the opportunity-management row to a `40/40/20` grid (matches | deals-to-progress | monthly goal) with equal-height cards.
- [x] 1.3 Merge recent activity and quick actions into a single activity-and-actions row at a `70/30` ratio, with quick actions in the narrow column.

## 2. Card refinements

- [x] 2.1 Restyle `RecommendedPropertyMatches` as recommendation-style stacked cards with an explicit "Attach property" action, no fabricated match score.
- [x] 2.2 Add per-row urgency/interest indicators and a single per-row quick action to the operational workspace cards (follow-ups, today's schedule, hot prospects).
- [x] 2.3 Confirm the quick actions panel renders correctly in the narrow activity-row column at all breakpoints.

## 3. Tests and verification

- [x] 3.1 Update `frontend/src/app/app/dashboard-content.test.tsx` for the new row order (no pipeline) and the merged activity-and-actions row.
- [x] 3.2 Add/update tests asserting per-row quick actions and recommendation-style match cards.
- [x] 3.3 Run frontend typecheck and lint on the changed dashboard files.
- [x] 3.4 Run `openspec validate align-dashboard-to-v2-layout --strict` and fix any issues.

# Design Notes

## Relationship to `redesign-dashboard-command-centre`

This is a follow-up refinement, not a rewrite. The command-centre change established the journey-first sections and the new widgets; this change only adjusts the lower two rows and per-item richness to match `dashboard_v2.json` literally. It must be applied after the command-centre change is archived, since it modifies `Opportunity management section`, `Quick Actions`, and the layout requirement, and removes `Lifecycle pipeline summary`.

## Target layout (matches `dashboard_v2.json` vertical_structure)

```
page_header                 greeting + Insights range (already in app-shell)
kpi_summary_row             5 equal cards (unchanged)
operational_workspace_row   3 equal cols: follow-ups | today's schedule | hot prospects
opportunity_management_row  40 / 40 / 20: matches | deals-to-progress | monthly goal
activity_and_actions_row    70 / 30: recent activity | quick actions (always visible)
```

The compact pipeline funnel is removed entirely. Rationale: `dashboard_v2.json` has no pipeline row and its `interaction_rules` say "Avoid large charts" and "Use operational summaries instead of BI-style reporting." Pipeline visibility remains available in the Deals/Leads workspaces.

## Matches as recommendation cards (still lightweight)

No matching engine is introduced. v2's `matching_recommendations.item_pattern` lists `thumbnail + match_score`, but with no engine we will NOT fabricate scores. Instead the card is restyled as recommendation-style stacked cards that present each in-flight lead lacking an active property link, with a clear "Attach property" action. A true ranking engine with scores/thumbnails remains a separate, larger future change.

## Per-row affordances

v2's `task_queue_card`, `schedule_card`, and `opportunity_card` item patterns include an urgency/interest indicator and a per-row quick action. We add concise per-row affordances (e.g. urgency dot/badge and a single action link such as "Call" / "Open" / "Attach") without turning rows into dense toolbars, keeping "minimal cognitive load."

## Quick actions always visible

v2 places quick actions in the `activity_and_actions_row` (30% column) and states "Quick actions should always remain visible." Moving them beside recent activity (rather than the final stacked block) satisfies this while the global top-bar create menu remains the always-available creation path.

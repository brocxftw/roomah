# Design Notes

## Section ordering (deliberate reversal)

The archived `redesign-dashboard-overview` change established an action-first order (Today's Tasks + Quick Actions before the KPI strip), and `resources/dashboard-design.json` `ux_rules` state "Always place primary actions above analytics." This change intentionally adopts the journey-first ordering requested for the command centre:

```
1. KPI health strip          (business health at a glance)
2. Operational workspace      (follow-ups → today's schedule → hot prospects)
3. Opportunity management     (property matches → deals to progress → monthly goal)
4. Recent activity
5. Quick actions
```

Rationale and mitigation:
- The KPI strip is treated as a thin, glanceable health bar, not an analytics block — it stays a single row of five consistent cards with no charts, consistent with "minimal reporting-focused content."
- Creation workflows remain reachable from the global top-bar create menu (`interaction_patterns.creation: global_create_button`), so placing the dashboard Quick Actions block last does not hide record creation.
- This reverses the prior requirement "Action panel appears first"; the spec delta therefore MODIFIES that requirement rather than leaving conflicting requirements in the baseline.

## Hot prospects — stage-based heuristic

No engagement/interest score exists in the data model. Hot prospects are defined as in-flight leads in the `Proposal` or `Negotiation` stages, ordered by most recent interaction. This reuses data already available and is cheap to compute. If an engagement score is added later, the heuristic can be upgraded without changing the card contract.

## Recommended property matches — lightweight signal

There is no preference-based matching engine. The backend already computes active lead→property links while building the funnel (`lead_properties` with `status = active`). The lightweight signal is: in-flight leads (`New`/`Contacted`/`Qualified`/`Proposal`/`Negotiation`) with no active linked property are "needs matching" and surfaced so the REN can attach inventory. Leads carry `budget_min/max` and `preferred_*` fields, so a true ranking engine remains a viable future change but is explicitly out of scope here.

## Deals requiring progression

Reuses the existing negotiation-stage lead list (`tasks.deals_closing_soon`) relabeled as "Deals Requiring Progression," linking into the deals/leads workspace. The dedicated deals workspace remains the source of truth for full deal records.

## Monthly goal

Read-only only. Uses `target_progress` (and `personal_progress` when the scope is a team/manager view). No editable target form on the dashboard, consistent with the existing "Dashboard excludes target editing form" requirement.

## Layout / design-system constraints

- Card-based, 8px spacing system, 12px card radius, white surfaces on `#F8FAFC`, status badges instead of coloured text, never more than two major content columns side-by-side.
- Equal-height cards within each row; concise operational summaries; one-click actions/links on every card.

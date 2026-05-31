## Context

The current `/app` dashboard renders a KPI strip before the user's urgent work, then repeats urgent counts in priority cards, then shows quick actions, agenda, pipeline, target editing, and activity as stacked sections. This conflicts with `resources/dashboard-design.json`, which defines an action-first dashboard pattern:

- Row 1: two-column action panel with task widget and quick actions.
- Row 2: five-card KPI summary.
- Row 3: two-column primary workspace with a primary table and activity feed.
- Row 4: two-column secondary workspace with pipeline summary and secondary table.

The dashboard API already returns most required data: priority counts, today's agenda, tasks, KPIs, funnel, recent activity, and target progress. The redesign should primarily reorganize and restyle the existing frontend widgets while keeping backend changes minimal.

## Goals / Non-Goals

**Goals:**

- Make the dashboard an operational command centre rather than an analytics-first overview.
- Ensure every dashboard element answers one of three questions:
  - What needs my attention now?
  - What is happening in my pipeline?
  - How is my business performing?
- Follow the design-system layout, spacing, card, table, timeline, and pipeline patterns from `resources/dashboard-design.json`.
- Remove duplicated task count surfaces and consolidate urgent work into a single top action panel.
- Keep KPIs concise and secondary to immediate tasks.
- Keep implementation scoped to the main `/app` dashboard.

**Non-Goals:**

- Redesigning `/app/manager`.
- Introducing decorative charts, advanced analytics, or predictive scoring.
- Overhauling the application shell, sidebar, global color system, or navigation.
- Changing database schema.
- Completing stale dashboard scaffold changes that are not required by this redesign.

## Decisions

### Decision: Use the design-system four-row dashboard pattern

The dashboard will be rebuilt around the design-system section order: action panel, KPI cards, primary workspace, then secondary workspace.

Alternative considered: keep the existing stacked layout and reorder sections. This is lower effort but does not meet the requested command-centre layout or the design system's two-column workspace pattern.

### Decision: Replace `PriorityCards` with a single Today's Tasks widget

The current `PriorityCards` duplicate urgent counts already present in `KpiStrip`. The redesign will remove `PriorityCards` and introduce a top-left Today's Tasks card with three rows: overdue follow-ups, today's viewings, and deals closing soon. Each row links to its relevant filtered workspace.

Alternative considered: keep `PriorityCards` and move them above KPIs. This preserves duplication and consumes too much vertical space for counts that should act as a compact triage surface.

### Decision: Place Quick Actions beside urgent tasks

Quick-create actions will be displayed in the top-right of row 1, using card-based buttons for common workflows: Add Lead, Add Property, Schedule Viewing, and Add Campaign. This matches the design-system `quick_action` pattern and keeps workflow creation visible at login.

Alternative considered: leave quick actions in a full-width row. This makes the dashboard taller and delays access to the main work queues.

### Decision: Keep KPIs concise and move them below action panel

The KPI strip will become the second row, using five consistent cards for Active Leads, Properties Listed, Deals Closed, Monthly Commission, and Follow-ups Due. KPI cards should be visually consistent, compact, and informational, not chart-heavy.

Alternative considered: remove follow-ups due from KPI cards because it also appears in Today's Tasks. It stays because it helps answer business performance at a glance, while the action-panel row remains the operational entry point.

### Decision: Promote active work queues into the main workspace

The primary workspace will use a 60/40 layout: today's appointments as the primary table and recent activity as the activity feed. The secondary workspace will use a 50/50 layout: pipeline summary on the left and follow-ups due on the right.

Alternative considered: use deals closing soon as the secondary table. Follow-ups due are more time-sensitive and better match "what needs my attention now"; deals closing soon remains visible in the top task widget.

### Decision: Keep the pipeline visual but remove secondary insight clutter

The pipeline will remain a visual customer-lifecycle progression with connected stages and counts. The separate analytical insight aside should be removed unless it directly points to an operational action.

Alternative considered: keep the current funnel insight panel. It adds explanation but does not directly support daily workflow management.

### Decision: Remove target editing from the dashboard

The editable target form is a settings workflow and should move out of the daily dashboard. The dashboard may show a read-only progress chip or compact target status in the KPI area if useful.

Alternative considered: keep target editing at the bottom. This preserves existing functionality but conflicts with the "daily operational decision-making" rule and adds a form-heavy section.

### Decision: Defer manager dashboard redesign

The `/app` dashboard redesign should not change `/app/manager`. Managers may still use `/app` as an operational view and `/app/manager` as a separate oversight page.

Alternative considered: unify REN and manager dashboard behavior in one change. This increases scope and risks mixing daily operational UX with team oversight analytics.

## Risks / Trade-offs

- Target editing is moved out of the dashboard -> Add a clear task to relocate the form to `/app/profile` or another settings surface before removing it from `/app`.
- KPI trend deltas may require additional backend calculations -> Treat trend deltas as optional for this redesign unless the implementation can add them cleanly without delaying the layout change.
- The dashboard route may continue returning unused target fields -> Keep the backend payload stable unless removing unused fields is explicitly needed.
- Existing empty dashboard-related OpenSpec changes may confuse future work -> Document that this change supersedes the dashboard layout portions of those scaffolds, but avoid deleting unrelated change directories without explicit cleanup intent.
- New layout could become crowded on smaller screens -> Use the existing responsive rule: desktop multi-column, tablet reduced columns, mobile single-column stacked cards.

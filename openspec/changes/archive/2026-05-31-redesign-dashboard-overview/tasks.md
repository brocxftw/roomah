## 1. Dashboard Data Contract

- [x] 1.1 Review `GET /dashboard` usage in `frontend/src/app/app/page.tsx` and confirm the existing payload supports the action panel, KPI summary, today's appointments, recent activity, pipeline, and follow-ups queue.
- [x] 1.2 Add or expose `properties_listed` in the frontend dashboard type if it is already returned by the backend KPI payload.
- [x] 1.3 Decide whether KPI trend deltas are included in this implementation; if included, add minimal previous-period fields to the dashboard API and frontend types.

## 2. Action Panel

- [x] 2.1 Replace `PriorityCards` with a new Today's Tasks widget that displays overdue follow-ups, viewings today, and deals closing soon as compact actionable rows.
- [x] 2.2 Ensure each Today's Tasks row links to the relevant filtered workspace for leads, viewings, or deals.
- [x] 2.3 Refactor `QuickActions` into a top action-panel card layout with Add Lead, Add Property, Schedule Viewing, and Add Campaign.

## 3. KPI Summary

- [x] 3.1 Restyle `KpiStrip` as the second dashboard row using five consistent KPI cards.
- [x] 3.2 Include Active Leads, Properties Listed, Deals Closed, Monthly Commission, and Follow-ups Due.
- [x] 3.3 Keep KPI content concise and remove any chart-like or decorative treatment from the KPI row.
- [x] 3.4 If target progress remains visible, render it only as a read-only compact indicator rather than an editable form.

## 4. Work Queues

- [x] 4.1 Promote today's appointments into the primary workspace as a CRM-style table with status badges and a View All link.
- [x] 4.2 Restyle recent activity as a compact vertical timeline/feed in the primary workspace.
- [x] 4.3 Add a follow-ups due queue for the secondary workspace, ordered by urgency and linking to relevant lead records.
- [x] 4.4 Preserve useful empty states for appointments, activity, and follow-ups.

## 5. Pipeline Workspace

- [x] 5.1 Slim the pipeline widget into a customer-lifecycle stage progression with connected stages and counts.
- [x] 5.2 Remove the current analytical insight aside unless it directly links to an operational action.
- [x] 5.3 Keep pipeline conversion information concise and secondary to stage progress.

## 6. Page Composition

- [x] 6.1 Rebuild `frontend/src/app/app/page.tsx` into the four-section command-centre order: action panel, KPI summary, primary workspace, pipeline/work queue workspace.
- [x] 6.2 Use desktop two-column layouts matching `resources/dashboard-design.json` and stack sections on smaller screens.
- [x] 6.3 Remove obsolete dashboard section titles that no longer match the redesigned information hierarchy.
- [x] 6.4 Remove the editable `TargetProgress` form from the main dashboard and move or preserve its editing path outside `/app`.

## 7. Verification

- [x] 7.1 Run frontend lint/type checks for the changed dashboard files.
- [x] 7.2 Verify the dashboard renders loading, populated, and empty states without runtime errors.
- [x] 7.3 Confirm every dashboard section answers one of the three operational questions from the spec.
- [x] 7.4 Confirm `/app/manager` behavior is unchanged by this redesign.

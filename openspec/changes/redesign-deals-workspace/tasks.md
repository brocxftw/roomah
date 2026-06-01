## 1. Dependencies and Data Model

- [x] 1.1 Add `@dnd-kit/core` to the frontend package for accessible Kanban drag-and-drop.
- [x] 1.2 Add Supabase migration extending `deals` with `stage`, `expected_close_date`, `probability_override`, `notes`, `lost_reason`, `lost_notes`, `lost_at`, `origin_viewing_id`, and supporting metadata needed by the workspace.
- [x] 1.3 Backfill existing `deals` rows as `stage = closed_won` while preserving existing `closed_at`, financial, lead, property, and owner values.
- [x] 1.4 Add database constraints for valid stage values, probability override range, terminal lost reason/timestamp requirements, and originating viewing references.
- [x] 1.5 Add indexes for team-scoped stage, owner, expected close date, closed date, originating viewing, and property/lead lookup queries.
- [x] 1.6 Add Supabase migration for URL-only `deal_documents` with team/deal scoping, label, URL, kind, created metadata, and indexes.
- [x] 1.7 Extend backend timeline event enum values for deal created, deal stage changed, deal note updated/added, deal document added/removed, deal won, and deal lost.

## 2. Backend Deal Domain and Hydration

- [x] 2.1 Add shared constants/helpers for deal stages, stage labels, stage colors, stage default probabilities, lost reasons, effective probability, and effective commission calculation.
- [x] 2.2 Update deal creation models so open deal creation defaults to `negotiation` and does not run the terminal win cascade.
- [x] 2.3 Add explicit Win Deal payload and endpoint that captures final financial values, sets `stage = closed_won`, stamps `closed_at`, and runs the existing lead/property/campaign conversion cascade.
- [x] 2.4 Add explicit Lose Deal payload and endpoint that requires valid lost reason, sets `stage = closed_lost`, stamps `lost_at`, stores optional notes, applies conservative lead/property release behavior, and emits timeline events.
- [x] 2.5 Add stage update behavior for non-terminal stage moves with access checks, validation, and deal stage changed timeline events.
- [x] 2.6 Add deal update behavior for current value, expected close date, probability override, notes, and commission-related editable fields.
- [x] 2.7 Add hydrated `GET /deals` with filters for search, owner, stage, property type, expected closing date, deal type, and access scope.
- [x] 2.8 Add hydrated `GET /deals/{deal_id}` with lead summary, property summary, owner summary, originating viewing summary, effective probability, projected commission, document summary, and timeline context.
- [x] 2.9 Add URL-only document endpoints for listing, creating, and deleting deal documents with team/deal access checks.
- [x] 2.10 Update dashboard and campaign conversion queries so actual closed revenue and conversion counters count `stage = closed_won` deals only.

## 3. Backend Tests

- [x] 3.1 Add tests for existing deals being represented as Closed Won after migration-aware behavior.
- [x] 3.2 Add tests that open deal creation starts in Negotiation and does not mark leads Won or properties Inactive.
- [x] 3.3 Add tests for Win Deal cascade preserving current close behavior and emitting deal won timeline events.
- [x] 3.4 Add tests for Lose Deal validation, lost reason persistence, property release behavior, conservative lead status handling, and timeline events.
- [x] 3.5 Add tests for non-terminal stage movement, invalid stage rejection, and terminal stages requiring explicit win/loss workflows.
- [x] 3.6 Add tests for probability override validation and effective probability calculation.
- [x] 3.7 Add tests for hydrated list/detail responses and filters across manager and REN access scopes.
- [x] 3.8 Add tests for URL-only deal document create/list/delete behavior and access isolation.
- [x] 3.9 Add tests for viewing-origin deal creation and duplicate conversion prevention.

## 4. Shared Deal Modal and Conversion Components

- [x] 4.1 Split the current shared close-deal modal into a Create Deal / Start Negotiating flow and a Win Deal / Close Now flow while preserving existing Leads behavior where required.
- [x] 4.2 Update the Create Deal modal to support originating viewing context, default deal type/value from property, expected close date, opening value, probability override, and notes.
- [x] 4.3 Update the Win Deal modal to use the explicit win endpoint and collect final sale/rental amount, fee overrides, lawyer fees, and commission override.
- [x] 4.4 Add reusable helpers/types for deal lead/property groups so Leads, Viewings, and Deals can open the correct modal variant consistently.

## 5. Viewings Integration

- [x] 5.1 Update the Viewings drawer to expose Start Negotiating and Close Now for eligible completed viewings with lead/property context.
- [x] 5.2 Wire Start Negotiating to create an open deal linked to `origin_viewing_id` and refresh the selected viewing conversion context.
- [x] 5.3 Wire Close Now to the Win Deal flow linked to the originating viewing and refresh the selected viewing conversion context.
- [x] 5.4 Update viewing hydration to recognize linked deals by `origin_viewing_id` in addition to lead/property conversion matching.
- [x] 5.5 Surface deal conversion state in the Viewings drawer without creating duplicate active deals for the same viewing.

## 6. Deals Workspace Shell and State

- [x] 6.1 Replace the current `/app/deals` closed-deals list with a ROOMAH workspace shell using existing AppShell title/action conventions.
- [x] 6.2 Implement URL state for `view=pipeline|list`, selected `deal=<id>`, drawer `tab=<tab>`, filters, and page/show-all behavior where applicable.
- [x] 6.3 Implement deal loading, selected deal loading, error states, loading states, and refresh helpers using hydrated backend responses.
- [x] 6.4 Implement five KPI cards for Pipeline Value, Weighted Pipeline, Closed Won (MTD), Commission MTD, and Win Rate.
- [x] 6.5 Implement a single-row advanced filter bar for search, owner, stage, property type, expected closing date, deal type, and reset.
- [x] 6.6 Ensure pipeline, list, KPI, and drawer state stay synchronized when filters, stages, wins, losses, or document changes occur.

## 7. Kanban Pipeline

- [x] 7.1 Implement the horizontal Kanban board with six columns: Negotiation, Offer Made, Pending Contract, Final Approval, Closed Won, and Closed Lost.
- [x] 7.2 Implement column headers with stage name, count, total value, and visual stage identity.
- [x] 7.3 Implement compact deal cards showing lead/property title, current deal value, owner, probability/health cue, expected close date, and high-interest viewing origin when present.
- [x] 7.4 Wire card selection to deep-linked drawer selection.
- [x] 7.5 Implement `@dnd-kit/core` drag-and-drop for non-terminal stage movement with optimistic UI and backend persistence.
- [x] 7.6 Prevent silent drag/drop into terminal stages and route those transitions through explicit Mark Won / Mark Lost flows.
- [x] 7.7 Add responsive horizontal scrolling on tablet/desktop and swipe-friendly single-column behavior where practical on mobile.

## 8. List View

- [x] 8.1 Implement the synchronized List view behind `?view=list`.
- [x] 8.2 Add table columns for deal reference, lead, property, owner, stage badge, current value, effective commission, expected close date, probability, recent activity, and actions.
- [x] 8.3 Add selected row highlighting, hover states, pagination/show-all behavior, and drawer selection.
- [x] 8.4 Ensure table filters and values match the Kanban view and KPI calculations.

## 9. Deal Command Drawer

- [x] 9.1 Build the persistent right-side deal drawer with responsive bottom-sheet behavior for smaller screens.
- [x] 9.2 Render drawer header with deal ID/reference, stage badge, value, expected close date, and close control.
- [x] 9.3 Add Overview tab with lead summary, property summary, owner, originating viewing context, interest rating, probability progress bar, notes, recent activity, and required action cues.
- [x] 9.4 Add Commission tab with current value/final value, commission rate, agency fee, lawyer fees, commission total, override, effective commission, and projected/final labeling.
- [x] 9.5 Add Timeline tab that displays deal-related lead timeline events plus originating viewing events.
- [x] 9.6 Add Documents tab for listing, adding, opening, and deleting URL-only document links.
- [x] 9.7 Add drawer footer actions for edit, move stage, mark won, mark lost, manage documents, and close.
- [x] 9.8 Add Mark Won flow from the drawer using the Win Deal modal and explicit win endpoint.
- [x] 9.9 Add Mark Lost flow from the drawer with lost reason, optional notes, confirmation, and explicit loss endpoint.

## 10. Validation and Polish

- [x] 10.1 Run backend tests for deals, viewings conversion, dashboards, campaign counters, and workflow regressions.
- [x] 10.2 Run frontend typecheck and lint.
- [x] 10.3 Run frontend tests and add focused tests where existing test infrastructure supports pure helpers or components.
- [x] 10.4 Run production frontend build.
- [x] 10.5 Validate OpenSpec change with `openspec validate redesign-deals-workspace --strict`.
- [ ] 10.6 Manually smoke test pipeline loading, filtering, drag/drop stage movement, list toggle, drawer tabs, Start Negotiating from Viewings, Close Now from Viewings, Mark Won, Mark Lost, document links, and manager/REN access behavior.

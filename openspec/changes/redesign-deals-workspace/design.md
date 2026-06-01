## Context

The existing Deals page only lists won transactions. The `deals` table stores financial closing fields (`sale_price`, commission fields, `closed_at`) and `POST /deals` immediately performs the terminal win cascade: mark the lead Won, mark the property Inactive, deactivate competing lead-property links, increment campaign conversion counters, and emit timeline events.

`resources/deals-design.json` describes a Kanban-first sales pipeline workspace with revenue KPIs, synchronized list view, filters, and a persistent right-side deal command drawer. The completed Viewings workspace now exposes high-interest completed viewings and an in-place conversion flow, but the current shared `CloseDealModal` closes a deal immediately instead of starting a managed negotiation pipeline.

This change turns Deals into the final revenue-management workspace in the ROOMAH customer lifecycle while preserving existing closed deal records as Closed Won rows.

## Goals / Non-Goals

**Goals:**

- Make Deals own the full revenue lifecycle from Negotiation through Closed Won/Lost.
- Preserve and backfill existing closed deals as Closed Won records.
- Make the Kanban pipeline the primary workspace and the List view a synchronized analytical alternative.
- Keep revenue metrics prominent through Pipeline Value, Weighted Pipeline, Closed Won (MTD), Commission MTD, and Win Rate.
- Let agents create deals from high-interest completed viewings without leaving the operational workflow.
- Carry lead, property, assigned agent, interest rating, notes, originating viewing, and relevant lead timeline context into the deal workflow.
- Provide a persistent deal command drawer for overview, commission, timeline, documents, stage movement, win/loss actions, notes, and projections.
- Use URL-only document links for v1.
- Reuse lead timeline events for deal activity continuity.
- Add accessible drag-and-drop with `@dnd-kit/core`.

**Non-Goals:**

- Supabase document/file uploads.
- External e-signing or loan-processing integrations.
- Payment, payout, clawback, or commission settlement accounting.
- Multi-currency support.
- Separate deal detail pages.
- Heavy analytics dashboards or large charting libraries.
- Full audit-history tables for every field edit.

## Decisions

### Deals own the full lifecycle

Add lifecycle columns to `deals` and treat a deal as an in-flight revenue opportunity, not only a closed transaction. Existing rows are backfilled with `stage = closed_won`. New rows default to `stage = negotiation` unless created through a Close Now / Win flow.

Stages:

- `negotiation`
- `offer_made`
- `pending_contract`
- `final_approval`
- `closed_won`
- `closed_lost`

Alternatives considered:

- Add a separate `deal_opportunities` table and keep `deals` as a won-only ledger. This protects the old meaning of `deals` but forces duplicate APIs, duplicate UI hydration, and complicated conversion from opportunity to deal.

### Use generic contract/approval stage labels

Use Pending Contract and Final Approval rather than sale-only Pending SPA and Loan Approval. This keeps one pipeline for Sale and Rental deals while still mapping naturally to SPA/loan workflows for sales and tenancy/landlord/deposit workflows for rentals. Closed Lost remains an always-visible sixth Kanban column with subdued styling and can be hidden through filters later if needed.

Alternatives considered:

- Sale-specific stages only. This is precise for SPA/loan deals but awkward for rentals.
- Type-specific stage sets. This is more accurate but creates multiple Kanban shapes, more validation, and a more complex table/filter model.

### Add `@dnd-kit/core` for Kanban drag-and-drop

Use `@dnd-kit/core` for accessible pointer, touch, and keyboard drag-and-drop. Keep drawer-based stage controls so stage movement remains possible without dragging.

Alternatives considered:

- Hand-rolled HTML5 drag events. This avoids a dependency but has weak touch and keyboard behavior.
- Click-to-move only. This is simpler but conflicts with the Kanban-first interaction called for by the design.

### Probability uses stage defaults plus optional override

Stage defaults drive weighted pipeline values:

- Negotiation: 30%
- Offer Made: 50%
- Pending Contract: 70%
- Final Approval: 85%
- Closed Won: 100%
- Closed Lost: 0%

Add nullable `probability_override` constrained to 0-100. Effective probability is override when present, otherwise the stage default. The drawer renders a progress bar and the KPI uses effective probability.

Alternatives considered:

- Stage-derived only. Consistent, but agents cannot reflect real deal confidence.
- Manual-only slider. Flexible, but easy to omit and inconsistent across agents.

### `sale_price` is current best offer until won

For open deals, `sale_price` represents the current best offer or expected transaction value. Commission projection is recomputed from the current `sale_price`, commission rate, agency fee, lawyer fees, and optional override. At Closed Won, `closed_at` is stamped and the values represent the final won transaction.

Alternatives considered:

- Add separate expected/final price columns. Cleaner semantics, but more UI and migration complexity for v1.
- Add full value history. Useful for later analytics, but not needed to ship the workspace.

### Terminal stage side effects are explicit

Moving a deal to Closed Won must use an explicit win action or endpoint that runs the existing terminal cascade. Moving a deal to Closed Lost must require `lost_reason`, stamp `lost_at`, emit a deal-lost timeline event, and release the property only when there is no other won deal for that property. Lead status changes on loss should be conservative: mark the lead Lost only when the deal was its last remaining active opportunity/link; otherwise keep it active for other opportunities.

Lost reasons:

- `budget`
- `financing_denied`
- `chose_competitor`
- `property_issue`
- `lead_unresponsive`
- `agent_decision`
- `other`

Alternatives considered:

- Allow direct drag into terminal columns with no modal. Faster, but too risky because terminal stages have irreversible business side effects.

### Split deal creation and winning flows

Split the current close modal behavior into:

- **Create Deal / Start Negotiating**: creates an open deal, usually from a completed viewing, defaulting to Negotiation.
- **Win Deal**: terminal flow that captures final price/fees/commission override and runs the Closed Won cascade.

The Viewings drawer should expose both Start Negotiating and Close Now. Start Negotiating is the default lifecycle path; Close Now is for on-the-spot wins.

Alternatives considered:

- Keep one modal that always wins. This preserves today's flow but bypasses the pipeline.
- Force every viewing through Negotiation. This is clean but misses valid immediate-close cases.

### Documents are URL-only in v1

Add `deal_documents` with label, URL, kind, created metadata, and team/deal scoping. The drawer Documents tab lists and adds links to external documents (SPA, loan, offer, tenancy, receipts, and supporting files). No Supabase storage bucket is introduced.

Alternatives considered:

- Stub Documents as coming soon. Too thin for the command drawer.
- Full file uploads. Operationally useful but adds storage, signed URL, cleanup, and permissions work outside this change's core.

### Reuse lead timelines for deal history

Deal events are stored as lead timeline events, scoped by `deal_id` in the payload where relevant. Add event types for deal creation, stage changes, notes, documents, won, and lost. The deal drawer Timeline tab filters the linked lead's timeline to deal-related events plus relevant prior viewing context.

Alternatives considered:

- Add `deal_timeline_events`. Cleaner isolation, but it fragments the customer lifecycle and duplicates existing timeline infrastructure.

### Hydrated deal responses power the workspace

`GET /deals` and `GET /deals/{deal_id}` should hydrate each deal with lead summary, property summary, owner summary, originating viewing summary, effective probability, projected commission, document counts, and recent timeline context. Filters should run server-side where supported by deal columns and in-memory only where hydration is needed for text/property matching.

Alternatives considered:

- Keep raw IDs and let the frontend fetch related records. This increases waterfall loading and duplicates hydration logic.

## Risks / Trade-offs

- **Changing `deals` semantics from won-only to lifecycle records** → Backfill existing rows as `closed_won`, keep terminal win behavior explicit, and update dashboard/reporting queries to filter terminal stages where they need actual closed revenue.
- **Terminal cascades can be triggered accidentally** → Require explicit Mark Won / Mark Lost flows with confirmation and required data; do not run terminal side effects on ordinary open-stage drag/drop.
- **Kanban drag-and-drop can add frontend complexity** → Use `@dnd-kit/core` and keep non-drag controls in the drawer for accessibility and fallback.
- **Weighted pipeline depends on data quality** → Provide sensible stage defaults and make probability override optional.
- **Rental and Sale workflows differ** → Use generic Pending Contract / Final Approval labels in v1 while preserving deal type for copy and filters.
- **Document URLs may contain sensitive external links** → Store URLs in team-scoped rows, rely on existing auth/RLS patterns, and do not fetch external content server-side.
- **Timeline filtering may miss historical context** → Include lead timeline events tied to the originating viewing and deal payloads in the drawer timeline, and keep the full lead timeline in Leads.

## Migration Plan

1. Add deal lifecycle columns to `deals`: `stage`, `expected_close_date`, `probability_override`, `notes`, `lost_reason`, `lost_notes`, `lost_at`, `origin_viewing_id`, and any value freshness metadata needed by the UI.
2. Backfill all existing deal rows with `stage = closed_won` and preserve existing `closed_at` values.
3. Add constraints for valid stage values, probability range, terminal lost reason/timestamp requirements, and indexes for team/stage/owner/expected-close-date queries.
4. Add `deal_documents` with team/deal scoping, URL validation, kind constraints, and created metadata.
5. Add new timeline event enum values and update emitters for deal creation, stage movement, document changes, notes, wins, and losses.
6. Update backend APIs so open deal creation no longer runs the win cascade, and move current cascade behavior into explicit win handling.
7. Update dashboards and campaign conversion calculations to count only `stage = closed_won` where actual closed revenue is required.
8. Ship the frontend Deals workspace and Viewings conversion updates.
9. Rollback strategy: keep nullable columns/tables in place, route the frontend back to closed-won list behavior, and keep existing won rows valid as Closed Won.

## Open Questions

- Should document URL validation accept only `http`/`https`, or also internal `mailto`/drive-specific schemes?
- Should deal notes be a single editable field in v1, or should adding notes always emit timeline note events as well?
- Should Win Rate use trailing 30 days, current month, or the active filter's date range for v1?

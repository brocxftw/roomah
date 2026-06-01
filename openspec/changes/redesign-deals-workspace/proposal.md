## Why

The current Deals page is a simple closed-transactions list, so it does not support the revenue operations workflow described by `resources/deals-design.json` or the ROOMAH lifecycle from qualified viewing to negotiation and closing. Agents need Deals to become the final customer-lifecycle workspace where strong viewing opportunities enter a managed pipeline, carry their context forward, and progress through revenue, commission, document, and closing actions without page navigation.

## What Changes

- Replace `/app/deals` with a ROOMAH master-detail revenue workspace built around a Kanban-style sales pipeline as the primary operational surface.
- Add five revenue KPI cards: Pipeline Value, Weighted Pipeline, Closed Won (MTD), Commission MTD, and Win Rate.
- Add a List / Pipeline segmented view toggle with `?view=list|pipeline` state, defaulting to List.
- Add advanced filtering for search, owner, stage, property type, expected closing date, and deal type while keeping pipeline and list views synchronized.
- Add a persistent right-side deal command drawer with overview, commission, timeline, and documents tabs plus sticky actions for editing, stage progression, marking won, marking lost, and managing deal context.
- Extend deals from closed-only transactions into full lifecycle records with stages: Negotiation, Offer Made, Pending Contract, Final Approval, Closed Won, and Closed Lost.
- Add drag-and-drop stage progression using `@dnd-kit/core` and keep an accessible drawer-based move/close path for non-drag workflows.
- Add stage-default probability with per-deal probability override so weighted pipeline and drawer probability visuals can be computed consistently.
- Treat `sale_price` as the current best offer during open stages, recomputing projected commission live and freezing final values only when the deal is marked Closed Won.
- Add expected closing date, deal notes, lost reason/notes, and originating viewing context to deal records.
- Add URL-only deal document tracking for external SPA, loan, offer, and supporting-document links without introducing file upload/storage in v1.
- Split the current close-deal flow into a pipeline-oriented Create Deal / Start Negotiating flow and a terminal Win Deal flow.
- Let completed high-interest viewings expose both Start Negotiating and Close Now actions, carrying over lead, property, assigned agent, interest rating, notes, and related timeline context into the deal workflow.
- Reuse lead timeline events for deal history, adding deal-specific timeline event types for stage changes, notes, documents, wins, and losses.
- Preserve existing closed deal data by backfilling current rows as `Closed Won`.

## Capabilities

### New Capabilities
- `deal-pipeline-workspace`: Deal lifecycle stages, revenue KPIs, Kanban/list workspace behavior, filters, drawer command centre, drag-and-drop stage movement, probability, commission projections, win/loss actions, and document links.
- `viewing-to-deal-conversion`: Conversion from completed high-interest viewings into deal pipeline records or immediate wins while carrying viewing, lead, property, agent, notes, interest, and timeline context forward.

### Modified Capabilities
<!-- None. There is no archived Deals capability under openspec/specs/ yet. -->

## Impact

- **Frontend**: Rewrites `frontend/src/app/app/deals/page.tsx`; updates shared deal modal components; updates Viewings drawer conversion actions; likely adds Kanban, KPI, filter, drawer, commission, timeline, and documents UI helpers.
- **Backend**: Extends `backend/app/routes/deals.py` with hydrated list/detail responses, filters, stage transitions, win/loss endpoints, notes/probability updates, document endpoints, and viewing-origin creation support.
- **Data model**: Adds deal lifecycle fields to `deals`, backfills existing deals as `closed_won`, adds URL-only `deal_documents`, and adds constraints/indexes for stage, probability, lost reasons, owner/date filters, and originating viewing links.
- **Dependencies**: Adds `@dnd-kit/core` for accessible Kanban drag-and-drop.
- **Timeline/events**: Adds deal-specific timeline event types while storing events on lead timelines for lifecycle continuity.
- **Existing behavior**: The current `POST /deals` close-now behavior becomes explicit terminal win behavior; existing closed deals remain represented as Closed Won records.
- **Out of scope**: Supabase file uploads, external document signing, payment/payout accounting, multi-currency support, large reporting dashboards, and separate deal detail pages.

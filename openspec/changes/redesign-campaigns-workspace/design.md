## Context

The Campaigns page currently renders a simple fetched list from `GET /campaigns?include_completed=true&include_draft=true`. It does not match the master-detail workspace pattern now used by Leads and Properties, and it does not expose enough operational context for campaign decisions.

`resources/campaigns-design.json` defines a three-panel CRM workspace with summary metrics, filtering, a campaign performance table, and a right-side insight drawer. The existing app shell already provides the left navigation and page container, so this change should focus on the Campaigns module content.

The backend already supports most campaign metrics needed for an operational workspace: `ad_spending`, `budget`, `impressions`, `clicks`, `leads_generated`, `conversions`, `cost_per_lead`, and `conversion_rate`. This change intentionally avoids platform analytics integration and uses only first-party campaign and lead data.

## Goals / Non-Goals

**Goals:**

- Make `/app/campaigns` a campaign command centre where users can monitor, compare, select, and act on campaigns without navigating away.
- Preserve ROOMAH's existing Leads/Properties master-detail interaction model: KPI row, filter bar, selected row highlighting, deep-linked right drawer, and quick actions.
- Surface operational KPIs first: Active Campaigns, Total Spend, Leads Generated, Conversions, Average Cost per Lead, and Conversion Rate.
- Add optional external campaign URL storage and render platform-aware "View on ..." buttons from the pasted URL.
- Keep campaign classification to existing channel buckets. No `campaign_type` field or filter is added.
- Reuse the campaign wizard for create, edit, and duplicate flows.

**Non-Goals:**

- External platform publishing or API integration.
- Imported platform analytics such as reach, engagement, comments, shares, or ad-manager delivery status.
- Persisted campaign timeline notes/events.
- Campaign content templates. Those are handled in `add-campaign-content-templates`.
- Redesigning unrelated modules outside the Leads campaign filter needed for "View Leads".

## Decisions

### Decision: Use the existing master-detail pattern

The Campaigns workspace will mirror the Leads and Properties modules. The center panel owns filters, KPI summaries, pagination, row selection, and table scanning. The drawer is rendered when a campaign is selected and deep-linked through `/app/campaigns?campaign=<id>&tab=<tab>`.

Alternative considered: keep campaigns as a list with links to detail pages. Rejected because the design direction is operational workspace usage, and the existing Leads/Properties pattern has already solved selection, drawer tabs, pagination, and quick actions.

### Decision: Use operational KPI cards, not reporting charts

The KPI row will show Active Campaigns, Total Spend, Leads Generated, Conversions, Average Cost per Lead, and Conversion Rate. Month-over-month trend can be derived from available campaign date and metric fields where practical; cards without a reliable prior period show a neutral trend label.

Alternative considered: include reach and engagement cards based on `impressions` and `clicks`. Rejected for the top-level row because the user's direction is operational tilt and because external platform metrics are not yet a trusted integration surface.

### Decision: Keep channel bucket only

The workspace will classify campaigns by existing `channel` values. It will not add `campaign_type`, audience, or location fields even though the design file mentions them. Drawer summary content will use available fields and derived labels instead.

Alternative considered: add a `campaign_type` enum. Rejected because the user chose channel bucket only and the current product can still deliver the command-centre workflow without a new classification field.

### Decision: Store one optional external URL and parse platform presentation from it

Campaigns will gain nullable `external_url`. The UI accepts HTTPS URLs and renders platform-specific labels/icons by parsing the URL host first, then falling back to campaign channel when the host cannot be classified. This allows Threads links to render as "View on Threads" without adding Threads to the campaign channel enum.

Alternative considered: require the URL host to match campaign channel. Rejected because users may paste short links, ad-manager links, or cross-posted campaign URLs.

### Decision: Use a focused four-card drawer performance summary

The drawer Performance tab will show Spend, Lead Generation, Conversion, and Efficiency cards. Spend includes spend versus budget; Lead Generation includes leads and cost per lead; Conversion includes conversions and conversion rate; Efficiency includes cost per lead and cost per conversion where data permits.

Alternative considered: implement the six design-file performance cards including reach and engagement. Rejected until platform integration is ready; `impressions` and `clicks` can remain secondary fields, but the drawer should not imply full platform analytics.

### Decision: Use a synthetic campaign timeline

The Timeline tab will render a read-only event stream from available facts: campaign created, status updated, metrics recomputed, leads attributed, and conversions recorded where the data can be inferred from campaign detail and attributed leads.

Alternative considered: add persisted `campaign_timeline_events`. Rejected for this iteration because manual notes and full audit trails would create a larger backend capability that is not needed for the workspace revamp.

### Decision: Duplicate through wizard prefill

Duplicate Campaign will route to `/app/campaigns/new?duplicate=<id>`. The wizard fetches the source campaign, pre-fills editable identity, channel, dates, budget, and external URL, then submits a normal create request with metrics reset unless the user changes them.

Alternative considered: add `POST /campaigns/{id}/duplicate`. Rejected because client-side prefill keeps the backend API smaller and matches the edit-via-wizard pattern already used in the Leads module.

### Decision: View Leads uses a campaign filter

The drawer "View Leads" action will route to `/app/leads?campaign=<campaign_id>`. The Leads workspace and list endpoint need campaign-id filtering so users land in a scoped view rather than an unfiltered leads list.

Alternative considered: only show attributed leads inside the campaign drawer. Rejected because users still need full Leads workspace actions for lead follow-up.

## Risks / Trade-offs

- External URL parsing can misclassify shortened links or ad-manager URLs -> accept the URL, show a generic "View campaign" fallback, and never block saving on host mismatch.
- Synthetic timelines can miss historical status changes because only the current row is available -> label the timeline as operational history from available data and avoid implying a complete audit trail.
- Client-side duplicate can accidentally carry over stale values from the source campaign -> reset generated metrics by default and clearly label the new record as a draft copy.
- Campaign-to-leads filtering touches another module -> keep the Leads change narrow to a campaign-id filter and URL state support.

## Migration Plan

1. Add nullable `external_url` to `marketing_campaigns`.
2. Extend backend campaign create/update payloads and list/detail serialization to include `external_url`.
3. Add campaign-id filtering to the leads list API and wire the Leads workspace URL state.
4. Build the Campaigns workspace UI around existing list/detail campaign endpoints.
5. Update the campaign wizard to support create, edit, and duplicate modes.
6. Verify existing campaigns render without external URLs and continue to load in the workspace.

Rollback strategy: hide external-link UI and leave `external_url` unused if needed. The column is nullable and does not affect existing campaign behavior.

## Open Questions

None. The remaining choices are implementation details within the decisions above.

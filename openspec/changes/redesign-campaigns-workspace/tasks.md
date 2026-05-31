## 1. Campaign Data Model and API

- [x] 1.1 Add nullable `external_url` support to the marketing campaigns data model and migration layer.
- [x] 1.2 Update campaign create and update payload models to accept optional HTTPS `external_url`.
- [x] 1.3 Update campaign list and detail responses to include `external_url`.
- [x] 1.4 Add backend validation for external URLs while allowing generic HTTPS links and platform short links.
- [x] 1.5 Add or update backend tests for campaign create, update, list, and detail behavior with and without `external_url`.

## 2. Campaign-Scoped Leads

- [x] 2.1 Add a campaign-id filter to the leads list API.
- [x] 2.2 Update the Leads workspace to read and preserve `/app/leads?campaign=<campaign_id>` URL state.
- [x] 2.3 Add a visible campaign-filter context state and clear action in the Leads workspace.
- [x] 2.4 Add or update tests for campaign-scoped lead listing.

## 3. Campaign Workspace State

- [x] 3.1 Define frontend campaign list, campaign detail, KPI, filter, drawer tab, and action types.
- [x] 3.2 Add selected campaign query-string state using `/app/campaigns?campaign=<id>&tab=<tab>`.
- [x] 3.3 Load selected campaign detail on demand without fetching detail payloads for every row.
- [x] 3.4 Add drawer dismissal and selected-row switching behavior consistent with Leads and Properties.

## 4. KPI and Filtering UI

- [x] 4.1 Build the six-card operational KPI row for Active Campaigns, Total Spend, Leads Generated, Conversions, Average Cost per Lead, and Conversion Rate.
- [x] 4.2 Add neutral trend handling when a KPI cannot calculate reliable prior-period data.
- [x] 4.3 Build the single-row filter bar with search, status, channel, date range, and reset controls.
- [x] 4.4 Reset pagination and selected campaign state appropriately when filters change.

## 5. Campaign Performance Table

- [x] 5.1 Replace the current campaign list with a performance table matching ROOMAH card, badge, border, and spacing patterns.
- [x] 5.2 Render campaign identity with channel/platform identifier, name, and campaign period metadata.
- [x] 5.3 Render status, spend, leads, conversions, cost per lead, and external-link affordance columns.
- [x] 5.4 Highlight the selected campaign row and update the drawer when a row is clicked.
- [x] 5.5 Add pagination at 20 rows per page with a Show All toggle.
- [x] 5.6 Add empty, loading, and error states, including a template CTA empty state reserved for the separate templates change.

## 6. External Campaign Link UI

- [x] 6.1 Add an external URL field to the campaign wizard create and edit modes.
- [x] 6.2 Add a URL-host parser that labels Facebook, Instagram, TikTok, Threads, Google, and generic campaign links.
- [x] 6.3 Render "View on ..." actions in campaign rows and drawer actions when `external_url` exists.
- [x] 6.4 Ensure external links open in a new tab with safe `rel` attributes.

## 7. Campaign Insight Drawer

- [x] 7.1 Build the right-side campaign drawer with Overview, Performance, Leads, and Timeline tabs.
- [x] 7.2 Add the Overview tab with campaign context, status, spend/budget summary, period, channel, and external-link action.
- [x] 7.3 Add the Performance tab with Spend, Lead Generation, Conversion, and Efficiency summary cards.
- [x] 7.4 Add the Leads tab with attributed leads and a View Leads action that opens `/app/leads?campaign=<id>`.
- [x] 7.5 Add the Timeline tab with synthetic read-only events derived from available campaign facts.
- [x] 7.6 Add sticky drawer quick actions for Edit Campaign, View Leads, Pause Campaign, Duplicate Campaign, and Open External Link when available.

## 8. Campaign Wizard Modes

- [x] 8.1 Extend `/app/campaigns/new` to support `?edit=<campaign_id>` with prefilled campaign data and PATCH submission.
- [x] 8.2 Extend `/app/campaigns/new` to support `?duplicate=<campaign_id>` with prefilled source values and POST submission as a new draft.
- [x] 8.3 Reset generated metrics by default in duplicate mode unless the user explicitly changes metric fields.
- [x] 8.4 Return users to the selected campaign workspace context after successful create or edit when possible.

## 9. Verification

- [x] 9.1 Run frontend lint and type checks for the campaign workspace and wizard files.
- [x] 9.2 Run backend tests for campaign and lead filter changes.
- [ ] 9.3 Manually verify the primary workflow: filter campaigns, select a campaign, open drawer tabs, view related leads, pause a campaign, duplicate a campaign, and open an external URL.
- [ ] 9.4 Manually verify responsive behavior for the campaign drawer and filter bar.

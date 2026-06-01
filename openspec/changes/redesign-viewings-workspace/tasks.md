## 1. Data Model and Migration

- [x] 1.1 Add Supabase migration for `viewings.follow_up_at`, `viewings.follow_up_status`, `viewings.cancellation_reason`, `viewings.cancelled_at`, and optional cancellation notes metadata.
- [x] 1.2 Add database constraints for supported follow-up statuses and cancellation reasons while keeping nullable fields valid for non-completed/non-cancelled viewings.
- [x] 1.3 Backfill completed viewings with `follow_up_at = completed_at + interval '2 days'` and `follow_up_status = pending` when missing.
- [x] 1.4 Add or update database indexes for team-scoped schedule, status, follow-up, and cancellation queries used by the workspace.

## 2. Backend Viewing APIs

- [x] 2.1 Extend viewing response serialization with hydrated lead summary, property summary, assigned agent summary, interest, notes, follow-up, cancellation, and conversion context.
- [x] 2.2 Add `GET /viewings/{viewing_id}` with the same access rules as listing and hydrated drawer data.
- [x] 2.3 Update `GET /viewings` to support workspace filters for search, status, assigned agent, property type, date range, and follow-up state.
- [x] 2.4 Update complete-viewing behavior to persist `follow_up_at` and `follow_up_status = pending` while preserving interest and notes behavior.
- [x] 2.5 Add reschedule behavior for updating an existing viewing's `scheduled_at` without creating a duplicate record.
- [x] 2.6 Add cancel behavior that sets `status = cancelled`, stores cancellation reason metadata, and prevents invalid reason values.
- [x] 2.7 Add follow-up update behavior for marking done, cancelling, reopening, and rescheduling viewing follow-ups.
- [x] 2.8 Add backend tests for hydrated listing/detail, completion follow-up persistence, cancellation reasons, no-show KPI data, rescheduling, and follow-up status updates.

## 3. Shared Conversion Modal

- [x] 3.1 Extract the existing Leads close-deal modal into a reusable component that preserves current Leads behavior.
- [x] 3.2 Support preselecting lead and property context when the reusable conversion modal is opened from Viewings.
- [x] 3.3 Refresh parent workspace state after successful conversion in both Leads and Viewings contexts.
- [x] 3.4 Add focused frontend tests or smoke coverage for the extracted conversion modal behavior where test infrastructure supports it.

## 4. Viewing Scheduler Updates

- [x] 4.1 Update `/app/viewings/new` to accept prefilled `date`, `time`, `lead`, `property`, and `assigned_ren` query values from calendar interactions.
- [x] 4.2 Add edit/reschedule query support for existing viewings and submit reschedules through the new backend behavior.
- [x] 4.3 Preserve the existing create-viewing path and access rules while adding edit/reschedule mode labels and validation.

## 5. Viewings Workspace Shell

- [x] 5.1 Replace the current `/app/viewings` list with the ROOMAH workspace shell and loading/error states.
- [x] 5.2 Implement five KPI cards for Today's Viewings, Average Interest, Cancelled / No-show, Completed This Month, and Conversion Rate.
- [x] 5.3 Implement query-driven selected viewing state using `/app/viewings?viewing=<id>&tab=<tab>`.
- [x] 5.4 Implement advanced filter controls for search, status, agent, property type, date range, follow-up state, and reset.
- [x] 5.5 Implement the operational viewings table with schedule, lead, property, assigned agent, status badge, interest, follow-up, and actions columns.
- [x] 5.6 Add pagination or show-all behavior consistent with Leads, Properties, and Campaigns workspaces.

## 6. Calendar and Agenda Workspace

- [x] 6.1 Implement calendar state for selected date, calendar view mode, and date navigation with URL persistence where useful.
- [x] 6.2 Implement month view with current-day highlight, event density, and viewing status markers.
- [x] 6.3 Implement week view with time slots, viewing cards, status/interest markers, and empty-slot scheduling affordances.
- [x] 6.4 Implement day view with time slots and viewing cards while keeping the agenda panel visible.
- [x] 6.5 Implement the daily agenda panel with time-ordered viewings, lead/property summaries, status indicators, interest ratings, and due follow-up work.
- [x] 6.6 Wire calendar and agenda item selection to open the viewing drawer instantly.

## 7. Viewing Detail Drawer

- [x] 7.1 Build the persistent right-side viewing drawer with responsive bottom-sheet behavior for smaller screens.
- [x] 7.2 Render viewing header with ID, status, scheduled date/time, and cancellation reason when applicable.
- [x] 7.3 Render stacked lead, property, and assigned agent summary cards with property context and thumbnail/fallback styling where available.
- [x] 7.4 Render highlighted customer interest card using compact 1-5 star semantics and descriptive labels.
- [x] 7.5 Render notes, follow-up recommendation, workflow progression, and activity/timeline context.
- [x] 7.6 Add drawer footer actions for edit, reschedule, cancel, complete when eligible, schedule/update follow-up, and convert to deal.
- [x] 7.7 Ensure drawer close, outside click, tab change, and invalid ID handling match existing ROOMAH workspace patterns.

## 9. Editable Interest Scale and Drawer Quick Actions

- [x] 9.1 Add Supabase migration that widens the `viewings.interest_level` CHECK constraint from `between 1 and 3` to `between 1 and 5` without dropping existing data.
- [x] 9.2 Update `ViewingComplete` to accept `interest_level` from 1 to 5 and add a dedicated `PATCH /viewings/{viewing_id}/interest` endpoint that updates `interest_level` (1-5) and optional notes for accessible viewings.
- [x] 9.3 Add backend tests for 5-star completion and the new interest update endpoint, including invalid-range rejection.
- [x] 9.4 Update completion form, table, agenda, and drawer renderings to use the 1-5 scale and matching descriptive labels.
- [x] 9.5 Replace the static drawer interest card with an editable 5-star picker that persists changes through the interest update endpoint.
- [x] 9.6 Add Cancel and No-show quick actions to the drawer footer that confirm before submitting, reuse the existing cancel endpoint with `lead_cancelled` and `no_show` reasons, and stay disabled when the viewing is already cancelled.
- [x] 9.7 Keep the Activity tab cancellation form available for cancellations that require custom reasons or notes.

## 8. Validation and Polish

- [x] 8.1 Run frontend lint and typecheck for changed files.
- [x] 8.2 Run backend tests covering viewings workflow changes.
- [x] 8.3 Verify the workspace visually aligns with `resources/viewings-design.json` and existing Leads, Properties, and Campaigns modules.
- [ ] 8.4 Manually smoke test scheduling from calendar slots, drawer selection, completion, cancellation with no-show reason, follow-up status changes, rescheduling, filtering, and in-place conversion.
- [x] 8.5 Update task checkboxes as implementation completes and note any deferred open questions before archiving.

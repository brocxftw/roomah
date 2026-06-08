## Context

The current Settings entry routes to `/app/profile`, which shows a read-only account summary plus personal and manager target-setting cards. Profile updates already use `PATCH /users/me` for `full_name`, `phone_number`, and `monthly_target_amount`, while self-updating `commission_rate` is explicitly forbidden. Manager team member commission and target editing currently live in the Manager workspace drawer via `PATCH /users/{user_id}`.

Authentication uses Supabase Auth in the browser client. Password updates can be handled through the active Supabase session, while session timeout is not a native per-user Supabase setting in this application. Notification delivery does not exist yet, so this change introduces persisted preferences only.

## Goals / Non-Goals

**Goals:**
- Redesign `/app/profile` into a Settings hub with Profile, Commission & Target, Notifications, Security, and footer sections.
- Let users update their own basic profile details, commission rate, monthly target, notification preferences, and idle timeout.
- Keep email and role read-only in Settings.
- Remove commission editing from the Manager team member drawer and keep only target editing there.
- Support password changes through Supabase Auth.
- Add an app-level idle auto-logout behavior driven by each user's stored timeout preference.
- Add a new Privacy Notice page linked from the Settings footer.

**Non-Goals:**
- Build email, push, or in-app notification delivery.
- Add audit history for settings changes.
- Change Supabase JWT expiry, refresh-token behavior, or project-level auth configuration.
- Add manager approval workflow for self-edited commission rates.
- Build a full legal privacy policy; the MVP page can use placeholder product privacy copy.

## Decisions

### Decision: Keep Settings at `/app/profile`

The existing app shell already routes Settings to `/app/profile`, and the current profile page owns target editing. The redesign will keep the route stable and change the page title/content to Settings.

Alternative considered: add `/app/settings` and redirect `/app/profile`. This creates more navigation churn without a meaningful product benefit for the MVP.

### Decision: Store notification preferences on the user record as JSON

Notification settings will be persisted as a `notification_preferences` JSON object on `public.users`. The frontend can render fixed preference categories and save the selected booleans through `PATCH /users/me`.

Alternative considered: a dedicated `user_notification_preferences` table. That is more normalized, but it adds API and migration overhead before any notification delivery system exists.

### Decision: Implement idle timeout as an app-level client behavior

The user record will store `session_timeout_minutes`. The authenticated frontend shell will observe user activity and call Supabase `signOut()` when the configured idle period elapses. This avoids pretending Supabase has a per-user JWT timeout setting while still giving users the requested control.

Alternative considered: changing Supabase auth session lifetime. That would be global, operationally broader, and not user-specific.

### Decision: Allow self-editing commission rate through `/users/me`

`commission_rate` will be removed from the forbidden fields list for self-updates and included in the allowed update payload. This matches the requested product behavior that commission settings move from the Manager drawer to personal Settings.

Alternative considered: render commission as read-only or manager-only. The user explicitly selected editable self-service commission settings.

### Decision: Use Supabase Auth for password changes

The Security section will call `supabase.auth.updateUser({ password })` from the active session after validating the form. If practical, the UI should re-authenticate with the user's current email/password before updating the password to reduce accidental or unattended-session risk.

Alternative considered: adding a backend password endpoint. That duplicates Supabase Auth behavior and would require service-role auth handling for no clear MVP benefit.

### Decision: Source app version from frontend package/environment

The Settings footer will display the application version from an environment value derived from `frontend/package.json` or a build-time constant, with `0.1.0` as the current package version fallback.

Alternative considered: hardcode the version in the page. That is simple but easy to forget during releases.

## Risks / Trade-offs

- Self-editable commission can affect compensation data trust → Keep this as an explicit MVP product decision, validate non-negative values, and leave room for future audit/approval requirements.
- Preferences-only notifications may look like they do something immediately → Label the section as communication preferences and avoid promising delivery behavior that does not exist.
- Client-side idle timeout is not a security boundary → Treat it as a UX/security convenience and keep Supabase session management unchanged.
- Password update errors can be provider-specific → Surface Supabase error messages clearly and keep the form isolated from backend settings saves.
- JSON notification preferences are flexible but less queryable → Accept this until delivery workflows need reporting or targeting at scale.

## Migration Plan

1. Add nullable/defaulted user columns for `notification_preferences` and `session_timeout_minutes`.
2. Extend backend user models and `PATCH /users/me` validation/update logic.
3. Redesign the frontend Settings page and wire each section to the correct client/API behavior.
4. Remove commission editing from the Manager drawer while preserving target editing.
5. Add the Privacy Notice page and footer link.
6. Add focused backend and frontend tests for settings persistence and restricted fields.

Rollback is straightforward because the database changes are additive. If the frontend must be reverted, unused columns can remain safely until a later cleanup migration.

## Open Questions

- Which notification categories should be considered final for MVP naming? Proposed defaults are follow-ups due, upcoming viewings, deals closing soon, coaching notes, and weekly performance summary.
- What idle timeout options should the UI expose? Proposed options are 15 minutes, 30 minutes, 1 hour, 4 hours, and never.
- Should commission rate be entered as a decimal fraction (`0.03`) or percentage (`3%`) in the UI? Existing backend data uses decimal values, but the UI should likely present a percentage and convert on save.

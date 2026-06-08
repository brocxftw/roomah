## 1. Data Model and API

- [x] 1.1 Add a Supabase migration for `users.notification_preferences` and `users.session_timeout_minutes` with safe defaults/nullability.
- [x] 1.2 Update backend user models to include `commission_rate`, `notification_preferences`, and `session_timeout_minutes` for current-user responses.
- [x] 1.3 Update `PATCH /users/me` validation to allow self-updating `commission_rate`, `notification_preferences`, and `session_timeout_minutes` while keeping email, role, team, and active status restricted.
- [x] 1.4 Add backend tests for successful current-user updates to profile fields, commission rate, monthly target, notification preferences, and idle timeout.
- [x] 1.5 Add backend tests confirming restricted current-user fields such as email, role, team, and active status remain blocked.

## 2. Settings Page Redesign

- [x] 2.1 Replace the existing `/app/profile` layout with a Settings hub containing Profile, Commission & Target, Notifications, Security, and footer sections.
- [x] 2.2 Implement Profile settings form for `full_name` and `phone_number`, with email and role displayed read-only.
- [x] 2.3 Implement Commission & Target settings for self-editing commission rate and personal monthly target.
- [x] 2.4 Preserve manager-only team monthly target editing on the Settings page when team target data applies.
- [x] 2.5 Implement Notification settings controls for persisted preference categories without claiming delivery is active.
- [x] 2.6 Implement Settings footer with app version and Privacy Notice link.

## 3. Security Behavior

- [x] 3.1 Add a password change form that validates confirmation and updates the password through Supabase Auth.
- [x] 3.2 Implement idle timeout preference saving in Security settings.
- [x] 3.3 Add an authenticated-app idle timeout listener that signs out the user after the configured inactivity duration.
- [x] 3.4 Ensure disabled idle timeout values do not trigger automatic sign-out.

## 4. Manager Workspace Adjustment

- [x] 4.1 Remove commission-rate input state, rendering, and save payload behavior from the Manager team member drawer.
- [x] 4.2 Verify the Manager drawer still supports team member target editing after commission removal.

## 5. Privacy Notice

- [x] 5.1 Add a Privacy Notice route with MVP privacy notice content.
- [x] 5.2 Ensure the Settings footer links to the Privacy Notice route and the page is accessible without breaking authenticated navigation.

## 7. Profile Picture

- [x] 7.1 Add a Supabase migration for `users.avatar_url` and an `avatars` storage bucket with own-folder write policies.
- [x] 7.2 Allow self-updating `avatar_url` on `PATCH /users/me` and include it in the current-user model.
- [x] 7.3 Add a profile picture section to Profile settings with upload, change, remove, and initials fallback.
- [x] 7.4 Upload the selected image to user-scoped storage and persist the public URL; reflect the avatar in the app header.
- [x] 7.5 Add frontend and backend tests for avatar rendering, upload, removal, and persistence.

## 6. Frontend Tests and Verification

- [x] 6.1 Add or update frontend tests for Settings section rendering and read-only email/role behavior.
- [x] 6.2 Add or update frontend tests for saving profile, commission/target, notification preferences, and idle timeout settings.
- [x] 6.3 Add or update frontend tests for password change success/error handling where feasible.
- [x] 6.4 Run backend tests covering user settings updates.
- [x] 6.5 Run frontend typecheck and lint.
- [x] 6.6 Run OpenSpec status/validation for `redesign-settings-page`.

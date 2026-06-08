## Why

The current Settings/Profile page is too thin for the account and operating preferences users now need to manage. Moving personal profile, commission, notification, security, and privacy/version information into a single settings hub keeps the Manager workspace focused on team operations while giving each user a clear place to manage their own account configuration.

## What Changes

- Redesign `/app/profile` as a Settings page with five ordered sections: Profile, Commission & Target, Notifications, Security, and Footer.
- Allow users to update basic profile details (`full_name`, `phone_number`) while keeping email and role read-only.
- Move commission-rate editing out of the Manager team member drawer and into the user's own Settings page.
- Keep monthly target editing available in Settings, and keep only the target editor in the Manager team member drawer.
- Add persisted notification preferences for future delivery behavior without implementing email or in-app notification delivery in this change.
- Add password change support using Supabase Auth and an app-level idle session timeout preference that signs the user out after inactivity.
- Add a Settings footer showing the app version and linking to a new Privacy Notice page.
- Add a new Privacy Notice page with MVP placeholder content.

## Capabilities

### New Capabilities
- `settings`: Defines the Settings page, editable account preferences, commission and target controls, notification preference persistence, security settings, app-level idle timeout behavior, and Privacy Notice footer/link behavior.

### Modified Capabilities
- None.

## Impact

- Frontend:
  - `frontend/src/app/app/profile/page.tsx` will be redesigned into the new Settings hub.
  - `frontend/src/app/app/manager/page.tsx` will remove commission editing from the team member drawer and leave target editing only.
  - A new Privacy Notice route will be added.
  - A client-side idle timeout mechanism will be introduced and wired into the authenticated app shell or auth context.
- Backend/API:
  - `PATCH /users/me` will allow self-updating `commission_rate`, `notification_preferences`, and `session_timeout_minutes` in addition to existing profile and target fields.
  - Existing manager/admin user update behavior remains available for manager-controlled team member target/status updates.
- Database:
  - Add persisted fields for notification preferences and session timeout settings on user records.
- Auth/Security:
  - Password changes will use Supabase Auth from the active authenticated session.
  - Idle session timeout is implemented at the application layer and does not change Supabase JWT expiry or refresh-token configuration.

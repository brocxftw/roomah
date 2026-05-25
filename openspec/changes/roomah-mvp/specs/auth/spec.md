## ADDED Requirements

### Requirement: Email and Google OAuth authentication

The system SHALL authenticate users via Supabase Auth using either email/password or Google OAuth, and SHALL persist the session across browser reloads until the user explicitly signs out or the session expires.

#### Scenario: First-time email sign-in

- **WHEN** a user signs in with a valid email and password for the first time
- **THEN** the system creates a `users` row keyed by the Supabase `auth.users` id, assigns `team_id` to the default team, sets `role = REN`, and redirects the user to the dashboard

#### Scenario: Returning Google OAuth sign-in

- **WHEN** a user with an existing account signs in with Google
- **THEN** the system resolves the existing `users` row by Supabase `auth.users` id, refreshes the session, and redirects the user to the dashboard with their previous role intact

#### Scenario: Session persistence across reload

- **WHEN** an authenticated user reloads the application
- **THEN** the system restores their session without prompting for credentials

#### Scenario: Sign out

- **WHEN** an authenticated user signs out
- **THEN** the system invalidates the session and redirects to the login screen

#### Scenario: Auth claims issued for RLS

- **WHEN** Supabase Auth issues an access token for an authenticated user
- **THEN** the token contains claims derived from the user's `users` row for `team_id`, `role`, and application `user_id` so RLS can enforce team and role access

### Requirement: Role enforcement

The system SHALL enforce two roles: `REN` and `MANAGER`. A `MANAGER` SHALL have all `REN` capabilities on their own records plus the team-management capabilities defined in the `team-management` spec. A `REN` SHALL NOT access manager-only routes or data outside their own ownership.

#### Scenario: REN attempts to access manager dashboard

- **WHEN** a user with `role = REN` requests the team manager dashboard route
- **THEN** the system returns a forbidden response and the UI shows a "not authorized" state

#### Scenario: Manager accesses own REN data

- **WHEN** a user with `role = MANAGER` accesses lead or property routes
- **THEN** the system serves them as an REN for records they own, in addition to the team-wide views available to managers

### Requirement: Team scaffolding

The system SHALL provision a `teams` table and SHALL assign every team-scoped record (`users`, `leads`, `properties`, `viewings`, `deals`, `timeline_events`, `team_config`) a non-null `team_id` foreign key. In the MVP exactly one team row exists; the schema MUST permit additional rows without migration.

#### Scenario: Default team seeded at bootstrap

- **WHEN** the application is deployed for the first time
- **THEN** the database contains exactly one row in `teams` representing the default team, and every new user is assigned to that team

#### Scenario: Cross-team isolation enforced by RLS

- **WHEN** a user authenticated for `team_id = A` queries any team-scoped table
- **THEN** the database returns only rows where `team_id = A`, regardless of how the query is constructed

### Requirement: Team configuration storage

The system SHALL persist team-level configuration in a `team_config` row keyed by `team_id`, containing `default_agency_fee`, `default_lawyer_fees`, and any other future team-wide defaults.

#### Scenario: Default fees readable by deal workflow

- **WHEN** the deal-close workflow loads
- **THEN** the system reads `default_agency_fee` and `default_lawyer_fees` from `team_config` for the current team and pre-fills the form

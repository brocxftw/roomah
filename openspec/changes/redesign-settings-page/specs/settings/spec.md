## ADDED Requirements

### Requirement: Settings hub layout
The system SHALL render the Settings page at the existing Settings navigation destination with five ordered areas: Profile settings, Commission & Target settings, Notification settings, Security settings, and a footer containing app version and Privacy Notice access.

#### Scenario: Authenticated user opens Settings
- **WHEN** an authenticated user clicks the Settings navigation item
- **THEN** the system displays the Settings page with Profile settings first, Commission & Target settings second, Notification settings third, Security settings fourth, and the footer last

#### Scenario: Settings keeps account configuration separate from operational dashboards
- **WHEN** an authenticated user reviews the Settings page
- **THEN** the page presents account and preference forms instead of operational dashboard analytics or team performance tables

### Requirement: Profile settings
The system SHALL allow authenticated users to update their own basic profile details, including full name and phone number, while displaying email and role as read-only account context.

#### Scenario: User updates profile details
- **WHEN** an authenticated user submits a new full name or phone number from Profile settings
- **THEN** the system persists the changed profile fields to the current user's record

#### Scenario: Email remains read-only
- **WHEN** an authenticated user views Profile settings
- **THEN** the user's email is displayed as read-only and cannot be submitted as an editable field

#### Scenario: Role remains read-only
- **WHEN** an authenticated user views Profile settings
- **THEN** the user's role is displayed as read-only and cannot be submitted as an editable field

### Requirement: Profile picture management
The system SHALL allow authenticated users to upload and change their profile picture from Profile settings, and SHALL display an initials fallback when no picture is set.

#### Scenario: User uploads a profile picture
- **WHEN** an authenticated user selects an image file in the profile picture control
- **THEN** the system uploads the image to user-scoped storage and persists the resulting picture URL to the current user's record

#### Scenario: Initials fallback when no picture is set
- **WHEN** an authenticated user without a profile picture views Profile settings
- **THEN** the system displays initials derived from the user's name instead of an image

#### Scenario: User removes a profile picture
- **WHEN** an authenticated user with a profile picture chooses to remove it
- **THEN** the system clears the stored picture URL and reverts to the initials fallback

### Requirement: Self-service commission and target settings
The system SHALL allow authenticated users to update their own commission rate and monthly target from Settings. The system SHALL keep manager team target editing available to manager users when team target data applies.

#### Scenario: User updates commission rate
- **WHEN** an authenticated user submits a valid non-negative commission rate from Settings
- **THEN** the system persists the commission rate to the current user's record

#### Scenario: User updates monthly target
- **WHEN** an authenticated user submits a valid non-negative monthly target from Settings
- **THEN** the system persists the monthly target to the current user's record

#### Scenario: Manager updates team target from Settings
- **WHEN** an authenticated manager user submits a valid team monthly target from Settings
- **THEN** the system persists the team monthly target using the existing manager team target behavior

#### Scenario: Invalid commission or target is rejected
- **WHEN** an authenticated user submits a negative commission rate or monthly target
- **THEN** the system rejects the update and keeps the existing stored values unchanged

### Requirement: Manager drawer excludes commission editing
The system SHALL remove commission-rate editing from the Manager workspace team member drawer. The Manager drawer SHALL continue to support team member target editing.

#### Scenario: Manager opens team member drawer
- **WHEN** an authenticated manager opens a team member drawer in the Manager workspace
- **THEN** the drawer displays target editing controls and does not display commission-rate editing controls

#### Scenario: Manager saves team member target
- **WHEN** an authenticated manager submits a team member target from the Manager drawer
- **THEN** the system persists the target for the selected team member using the existing manager user update behavior

### Requirement: Notification preference settings
The system SHALL allow authenticated users to configure and persist notification preferences for predefined categories without implementing notification delivery in this change.

#### Scenario: User saves notification preferences
- **WHEN** an authenticated user changes notification preference toggles and submits the Notification settings form
- **THEN** the system persists the selected preference values to the current user's record

#### Scenario: User returns to Settings
- **WHEN** an authenticated user revisits Settings after saving notification preferences
- **THEN** the system displays the saved notification preference values

#### Scenario: Delivery is not implied
- **WHEN** notification preference controls are displayed
- **THEN** the UI does not claim that email, push, or in-app notification delivery is implemented by this change

### Requirement: Security settings
The system SHALL provide Security settings for changing password and configuring an app-level idle session timeout.

#### Scenario: User changes password
- **WHEN** an authenticated user submits a valid password change from Security settings
- **THEN** the system updates the user's Supabase Auth password and communicates success or any provider error

#### Scenario: User saves idle timeout
- **WHEN** an authenticated user selects and saves an idle timeout value
- **THEN** the system persists the selected timeout value to the current user's record

#### Scenario: Idle timeout signs out inactive user
- **WHEN** an authenticated user has a non-disabled idle timeout configured and remains inactive past that duration
- **THEN** the frontend signs the user out of the application

#### Scenario: Disabled idle timeout does not auto sign out
- **WHEN** an authenticated user has disabled idle timeout
- **THEN** the frontend does not sign the user out solely because of local inactivity

### Requirement: Settings footer and Privacy Notice
The system SHALL display the current app version in the Settings footer and provide a link to a Privacy Notice page.

#### Scenario: Footer shows version and privacy link
- **WHEN** an authenticated user views the Settings footer
- **THEN** the footer displays the app version and a link to the Privacy Notice page

#### Scenario: User opens Privacy Notice
- **WHEN** a user follows the Privacy Notice link
- **THEN** the system displays a Privacy Notice page with MVP privacy content

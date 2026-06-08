"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";

type TargetProgressData = {
  scope: "personal" | "team";
  target_amount: string | null;
  current_amount: string;
  progress_ratio: number | null;
  date_range: string;
};

export type DashboardTargets = {
  target_progress: TargetProgressData;
  personal_progress: TargetProgressData | null;
};

export type NotificationPreference = {
  in_app: boolean;
  email: boolean;
};

export type NotificationPreferences = Record<string, NotificationPreference>;

export type SettingsUser = {
  email: string;
  full_name: string;
  phone_number?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  commission_rate?: string | number | null;
  monthly_target_amount?: string | number | null;
  notification_preferences?: NotificationPreferences | null;
  session_timeout_minutes?: number | null;
};

export type ProfileValues = {
  full_name: string;
  phone_number: string | null;
};

export type CommissionTargetValues = {
  commission_rate: number;
  monthly_target_amount: number | null;
};

export type SecurityValues = {
  session_timeout_minutes: number | null;
};

export type PasswordValues = {
  currentPassword: string;
  newPassword: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  follow_ups_due: { in_app: true, email: false },
  upcoming_viewings: { in_app: true, email: false },
  deals_closing_soon: { in_app: true, email: false },
  coaching_notes: { in_app: true, email: false },
  weekly_performance_summary: { in_app: false, email: false },
};

const NOTIFICATION_CATEGORIES = [
  {
    key: "follow_ups_due",
    label: "Follow-ups due",
    description: "Reminders for leads that need attention.",
  },
  {
    key: "upcoming_viewings",
    label: "Upcoming viewings",
    description: "Viewing preparation and schedule reminders.",
  },
  {
    key: "deals_closing_soon",
    label: "Deals closing soon",
    description: "Deal deadlines and closing-risk reminders.",
  },
  {
    key: "coaching_notes",
    label: "Coaching notes",
    description: "Updates when coaching notes are added.",
  },
  {
    key: "weekly_performance_summary",
    label: "Weekly performance summary",
    description: "A future weekly digest of your pipeline performance.",
  },
];

const IDLE_TIMEOUT_OPTIONS = [
  { value: "", label: "Never" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
];

function mergePreferences(
  preferences: NotificationPreferences | null | undefined
): NotificationPreferences {
  const merged: NotificationPreferences = {};
  for (const category of NOTIFICATION_CATEGORIES) {
    merged[category.key] = {
      ...DEFAULT_NOTIFICATION_PREFERENCES[category.key],
      ...(preferences?.[category.key] ?? {}),
    };
  }
  return merged;
}

function decimalRateToPercent(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "";
  return String(Number((numeric * 100).toFixed(3)));
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCurrency(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        step={step}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      />
    </label>
  );
}

function SaveButton({ children, saving }: { children: string; saving: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {saving ? "Saving..." : children}
    </button>
  );
}

function StatusMessage({
  state,
  errorMessage,
}: {
  state: SaveState;
  errorMessage?: string | null;
}) {
  if (state === "idle") return null;
  if (state === "saved") {
    return <p className="text-xs text-emerald-600">Saved.</p>;
  }
  if (state === "error") {
    return (
      <p className="text-xs text-red-600">
        {errorMessage ?? "Unable to save changes."}
      </p>
    );
  }
  return null;
}

export function SettingsPageContent({
  user,
  targets,
  appVersion = "0.1.0",
  onSaveProfile,
  onSaveCommissionTarget,
  onSaveNotifications,
  onSaveSecurity,
  onChangePassword,
  onSaveTeamTarget,
  onUploadAvatar,
  onRemoveAvatar,
}: {
  user: SettingsUser;
  targets: DashboardTargets;
  appVersion?: string;
  onSaveProfile: (values: ProfileValues) => Promise<void>;
  onSaveCommissionTarget: (values: CommissionTargetValues) => Promise<void>;
  onSaveNotifications: (values: NotificationPreferences) => Promise<void>;
  onSaveSecurity: (values: SecurityValues) => Promise<void>;
  onChangePassword: (values: PasswordValues) => Promise<void>;
  onSaveTeamTarget?: (amount: number) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
}) {
  const [profile, setProfile] = useState({
    full_name: user.full_name,
    phone_number: user.phone_number ?? "",
  });
  const [commissionPercent, setCommissionPercent] = useState(
    decimalRateToPercent(user.commission_rate)
  );
  const [personalTarget, setPersonalTarget] = useState(
    String(user.monthly_target_amount ?? targets.personal_progress?.target_amount ?? "")
  );
  const [teamTargetAmount, setTeamTargetAmount] = useState(
    targets.target_progress.scope === "team"
      ? String(targets.target_progress.target_amount ?? "")
      : ""
  );
  const [notifications, setNotifications] = useState(() =>
    mergePreferences(user.notification_preferences)
  );
  const [sessionTimeout, setSessionTimeout] = useState(
    user.session_timeout_minutes ? String(user.session_timeout_minutes) : ""
  );
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileState, setProfileState] = useState<SaveState>("idle");
  const [avatarState, setAvatarState] = useState<SaveState>("idle");
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [commissionState, setCommissionState] = useState<SaveState>("idle");
  const [notificationState, setNotificationState] = useState<SaveState>("idle");
  const [securityState, setSecurityState] = useState<SaveState>("idle");
  const [passwordState, setPasswordState] = useState<SaveState>("idle");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const personalProgress = targets.personal_progress ?? targets.target_progress;
  const personalProgressPercent = Math.min(
    Math.round((personalProgress.progress_ratio ?? 0) * 100),
    100
  );
  const isManager = user.role === "MANAGER";
  const teamTarget =
    isManager && targets.target_progress.scope === "team"
      ? targets.target_progress
      : null;

  const notificationRows = useMemo(
    () =>
      NOTIFICATION_CATEGORIES.map((category) => ({
        ...category,
        preference: notifications[category.key],
      })),
    [notifications]
  );

  async function runSave(
    setState: (state: SaveState) => void,
    action: () => Promise<void>,
    onError?: (message: string) => void
  ) {
    setState("saving");
    try {
      await action();
      setState("saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save.";
      onError?.(message);
      setState("error");
    }
  }

  async function handleAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarMessage(null);
    await runSave(setAvatarState, () => onUploadAvatar(file), setAvatarMessage);
  }

  async function handleAvatarRemove() {
    setAvatarMessage(null);
    await runSave(setAvatarState, () => onRemoveAvatar(), setAvatarMessage);
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSave(profileState === "saving" ? () => {} : setProfileState, () =>
      onSaveProfile({
        full_name: profile.full_name,
        phone_number: profile.phone_number.trim() || null,
      })
    );
  }

  async function submitCommissionTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSave(setCommissionState, () =>
      onSaveCommissionTarget({
        commission_rate: Number(commissionPercent) / 100,
        monthly_target_amount: nullableNumber(personalTarget),
      })
    );
  }

  async function submitTeamTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSaveTeamTarget) return;
    await runSave(setCommissionState, () =>
      onSaveTeamTarget(Number(teamTargetAmount))
    );
  }

  async function submitNotifications(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSave(setNotificationState, () => onSaveNotifications(notifications));
  }

  async function submitSecurity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSave(setSecurityState, () =>
      onSaveSecurity({
        session_timeout_minutes: sessionTimeout ? Number(sessionTimeout) : null,
      })
    );
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }
    await runSave(
      setPasswordState,
      () =>
        onChangePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      setPasswordMessage
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Profile settings"
        description="Update basic account details. Email and role are managed by the workspace."
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt={`${user.full_name} profile photo`}
                className="size-full object-cover"
              />
            ) : (
              <span aria-hidden>{initialsFromName(user.full_name)}</span>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Profile picture
            </p>
            <p className="text-sm text-slate-500">
              Upload a square image (JPG, PNG, or WebP) up to 5MB.
            </p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Profile picture"
              className="sr-only"
              onChange={handleAvatarSelected}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={avatarState === "saving"}
                onClick={() => avatarInputRef.current?.click()}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {avatarState === "saving"
                  ? "Uploading..."
                  : user.avatar_url
                    ? "Change photo"
                    : "Upload photo"}
              </button>
              {user.avatar_url ? (
                <button
                  type="button"
                  disabled={avatarState === "saving"}
                  onClick={() => void handleAvatarRemove()}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Remove photo
                </button>
              ) : null}
              <StatusMessage state={avatarState} errorMessage={avatarMessage} />
            </div>
          </div>
        </div>

        <form onSubmit={submitProfile} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Full name"
              value={profile.full_name}
              onChange={(value) => setProfile({ ...profile, full_name: value })}
            />
            <TextInput
              label="Phone number"
              value={profile.phone_number}
              onChange={(value) =>
                setProfile({ ...profile, phone_number: value })
              }
            />
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </p>
              <p className="mt-1 text-slate-950 dark:text-slate-50">
                {user.email}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </p>
              <p className="mt-1 text-slate-950 dark:text-slate-50">
                {user.role ?? "REN"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveButton saving={profileState === "saving"}>Save profile</SaveButton>
            <StatusMessage state={profileState} />
          </div>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Commission & Target settings"
        description="Manage your commission rate and monthly target from one place."
      >
        <div className="space-y-5">
          <form onSubmit={submitCommissionTarget} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Commission rate (%)"
                type="number"
                step="0.001"
                value={commissionPercent}
                onChange={setCommissionPercent}
              />
              <TextInput
                label="Personal monthly target"
                type="number"
                value={personalTarget}
                onChange={setPersonalTarget}
              />
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="font-medium text-slate-700 dark:text-slate-200">
                Personal progress
              </p>
              <p className="mt-1 text-slate-500">
                {formatCurrency(personalProgress.current_amount)} of{" "}
                {personalProgress.target_amount
                  ? formatCurrency(personalProgress.target_amount)
                  : "no target"}{" "}
                ({personalProgressPercent}%)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SaveButton saving={commissionState === "saving"}>
                Save commission and target
              </SaveButton>
              <StatusMessage state={commissionState} />
            </div>
          </form>

          {teamTarget ? (
            <form
              onSubmit={submitTeamTarget}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
            >
              <TextInput
                label="Team monthly target"
                type="number"
                value={teamTargetAmount}
                onChange={setTeamTargetAmount}
              />
              <p className="mt-2 text-xs text-slate-500">
                Manager-only team target used by team dashboard performance.
              </p>
              <div className="mt-4">
                <SaveButton saving={commissionState === "saving"}>
                  Save team target
                </SaveButton>
              </div>
            </form>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Notification settings"
        description="Choose the preferences future notification delivery will use."
      >
        <form onSubmit={submitNotifications} className="space-y-4">
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60">
            Delivery is not active yet. These preferences are saved now so future
            email and in-app notifications can respect your choices.
          </p>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {notificationRows.map((row) => (
              <div
                key={row.key}
                className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {row.label}
                  </p>
                  <p className="text-sm text-slate-500">{row.description}</p>
                </div>
                {(["in_app", "email"] as const).map((channel) => (
                  <label
                    key={channel}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={row.preference[channel]}
                      onChange={(event) =>
                        setNotifications({
                          ...notifications,
                          [row.key]: {
                            ...row.preference,
                            [channel]: event.target.checked,
                          },
                        })
                      }
                      className="size-4 rounded border-slate-300"
                    />
                    {channel === "in_app" ? "In-app" : "Email"} {row.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveButton saving={notificationState === "saving"}>
              Save notification preferences
            </SaveButton>
            <StatusMessage state={notificationState} />
          </div>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Security settings"
        description="Update your password and choose when ROOMAH signs out after inactivity."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={submitPassword} className="space-y-4">
            <TextInput
              label="Current password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(value) =>
                setPasswordForm({ ...passwordForm, currentPassword: value })
              }
            />
            <TextInput
              label="New password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(value) =>
                setPasswordForm({ ...passwordForm, newPassword: value })
              }
            />
            <TextInput
              label="Confirm new password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(value) =>
                setPasswordForm({ ...passwordForm, confirmPassword: value })
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <SaveButton saving={passwordState === "saving"}>
                Update password
              </SaveButton>
              {passwordMessage ? (
                <p className="text-xs text-red-600">{passwordMessage}</p>
              ) : (
                <StatusMessage state={passwordState} />
              )}
            </div>
          </form>

          <form onSubmit={submitSecurity} className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Idle session timeout
              </span>
              <select
                value={sessionTimeout}
                onChange={(event) => setSessionTimeout(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              >
                {IDLE_TIMEOUT_OPTIONS.map((option) => (
                  <option key={option.value || "never"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-slate-500">
              This is an app-level idle sign-out preference. It does not change
              Supabase token lifetime.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <SaveButton saving={securityState === "saving"}>
                Save security preferences
              </SaveButton>
              <StatusMessage state={securityState} />
            </div>
          </form>
        </div>
      </SettingsCard>

      <footer className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
        <span>ROOMAH v{appVersion}</span>
        <Link
          href="/privacy"
          className="font-medium text-slate-700 underline-offset-4 hover:underline dark:text-slate-200"
        >
          Privacy Notice
        </Link>
      </footer>
    </div>
  );
}

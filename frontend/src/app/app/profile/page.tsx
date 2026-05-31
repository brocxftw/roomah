"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type CurrentUser = {
  email: string;
  full_name: string;
  phone_number?: string | null;
  role?: string | null;
  monthly_target_amount?: string | number | null;
};

type TargetProgressData = {
  scope: "personal" | "team";
  target_amount: string | null;
  current_amount: string;
  progress_ratio: number | null;
  date_range: string;
};

type DashboardTargets = {
  target_progress: TargetProgressData;
  personal_progress: TargetProgressData | null;
};

function TargetSettingsCard({
  title,
  description,
  target,
  onSave,
}: {
  title: string;
  description: string;
  target: TargetProgressData;
  onSave: (amount: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(target.target_amount ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const percent = Math.min(Math.round((target.progress_ratio ?? 0) * 100), 100);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!amount) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSave(amount);
      setMessage("Target updated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to update target."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-right dark:bg-slate-800">
          <p className="text-xs text-slate-500">Current progress</p>
          <p className="text-sm font-semibold">{percent}%</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        RM {target.current_amount} of{" "}
        {target.target_amount ? `RM ${target.target_amount}` : "no target"}
      </p>

      <form
        onSubmit={submit}
        className="mt-5 flex flex-wrap items-center gap-2"
      >
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Set monthly target (RM)"
          className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={saving || !amount}
          className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? "Saving..." : "Save Target"}
        </button>
      </form>
      {message ? (
        <p className="mt-2 text-xs text-slate-500">{message}</p>
      ) : null}
    </section>
  );
}

export default function ProfilePage() {
  const { getToken } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [targets, setTargets] = useState<DashboardTargets | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    const token = await getToken();
    const [me, dashboard] = await Promise.all([
      apiFetch<CurrentUser>("/users/me", token),
      apiFetch<DashboardTargets>("/dashboard?date_range=month", token),
    ]);
    setUser(me);
    setTargets(dashboard);
    setError(null);
  }

  useEffect(() => {
    void loadProfile().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  async function saveTarget(scope: "personal" | "team", amount: string) {
    const token = await getToken();
    const endpoint = scope === "team" ? "/manager/team-target" : "/users/me";
    await apiFetch(endpoint, token, {
      method: "PATCH",
      body: JSON.stringify({ monthly_target_amount: Number(amount) }),
    });
    await loadProfile();
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!user || !targets) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  const isManager = user.role === "MANAGER";
  const teamTarget =
    isManager && targets.target_progress.scope === "team"
      ? targets.target_progress
      : null;
  const personalTarget = targets.personal_progress ?? targets.target_progress;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Name
            </dt>
            <dd className="mt-1 text-slate-950 dark:text-slate-50">
              {user.full_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </dt>
            <dd className="mt-1 text-slate-950 dark:text-slate-50">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
            </dt>
            <dd className="mt-1 text-slate-950 dark:text-slate-50">
              {user.role ?? "REN"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phone
            </dt>
            <dd className="mt-1 text-slate-950 dark:text-slate-50">
              {user.phone_number ?? "-"}
            </dd>
          </div>
        </dl>
      </section>

      {teamTarget ? (
        <TargetSettingsCard
          title="Team Monthly Target"
          description="Used by the dashboard as read-only performance context."
          target={teamTarget}
          onSave={(amount) => saveTarget("team", amount)}
        />
      ) : null}

      <TargetSettingsCard
        title="Your Monthly Target"
        description="Used by your dashboard as read-only performance context."
        target={personalTarget}
        onSave={(amount) => saveTarget("personal", amount)}
      />
    </div>
  );
}

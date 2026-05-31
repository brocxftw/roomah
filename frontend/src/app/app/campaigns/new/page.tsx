"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

const campaignChannels = [
  "Facebook",
  "Instagram",
  "Google",
  "TikTok",
  "Email",
  "Referral",
  "Walk_In",
  "Other",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(campaignChannels[0]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [adSpending, setAdSpending] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch("/campaigns", token, {
        method: "POST",
        body: JSON.stringify({
          name,
          channel,
          campaign_start_date: startDate,
          campaign_end_date: endDate || null,
          budget: budget ? Number(budget) : null,
          ad_spending: adSpending ? Number(adSpending) : 0,
          impressions: impressions ? Number(impressions) : 0,
          clicks: clicks ? Number(clicks) : 0,
        }),
      });
      router.push("/app/campaigns");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create campaign"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">
          Campaign Details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Create a draft campaign that can be attributed to new and existing
          leads.
        </p>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Campaign name
            </span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Channel
            </span>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            >
              {campaignChannels.map((campaignChannel) => (
                <option key={campaignChannel} value={campaignChannel}>
                  {campaignChannel}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Start date
            </span>
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              End date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">
          Budget and Metrics
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Optional starting values. Campaign counters update as leads convert.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Budget (RM)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Ad spending (RM)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={adSpending}
              onChange={(event) => setAdSpending(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Impressions
            </span>
            <input
              type="number"
              min="0"
              value={impressions}
              onChange={(event) => setImpressions(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Clicks
            </span>
            <input
              type="number"
              min="0"
              value={clicks}
              onChange={(event) => setClicks(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/app/campaigns")}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name}
          className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? "Creating..." : "Create Campaign"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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

type CampaignFormRecord = {
  id: string;
  name: string;
  channel: string;
  campaign_start_date: string;
  campaign_end_date?: string | null;
  budget?: string | number | null;
  ad_spending?: string | number | null;
  impressions?: number | null;
  clicks?: number | null;
  external_url?: string | null;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const editId = searchParams.get("edit");
  const duplicateId = searchParams.get("duplicate");
  const sourceId = editId ?? duplicateId;
  const isEditMode = Boolean(editId);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(campaignChannels[0]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [adSpending, setAdSpending] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId) return;

    async function loadSourceCampaign() {
      setLoadingSource(true);
      setError(null);
      try {
        const token = await getToken();
        const campaign = await apiFetch<CampaignFormRecord>(
          `/campaigns/${sourceId}`,
          token
        );
        setName(duplicateId ? `${campaign.name} Copy` : campaign.name);
        setChannel(campaign.channel);
        setStartDate(campaign.campaign_start_date);
        setEndDate(campaign.campaign_end_date ?? "");
        setBudget(campaign.budget ? String(campaign.budget) : "");
        setExternalUrl(campaign.external_url ?? "");
        if (editId) {
          setAdSpending(
            campaign.ad_spending !== null && campaign.ad_spending !== undefined
              ? String(campaign.ad_spending)
              : ""
          );
          setImpressions(
            campaign.impressions !== null && campaign.impressions !== undefined
              ? String(campaign.impressions)
              : ""
          );
          setClicks(
            campaign.clicks !== null && campaign.clicks !== undefined
              ? String(campaign.clicks)
              : ""
          );
        } else {
          setAdSpending("");
          setImpressions("");
          setClicks("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaign");
      } finally {
        setLoadingSource(false);
      }
    }

    void loadSourceCampaign();
  }, [duplicateId, editId, getToken, sourceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const saved = await apiFetch<CampaignFormRecord>(
        editId ? `/campaigns/${editId}` : "/campaigns",
        token,
        {
          method: editId ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            channel,
            campaign_start_date: startDate,
            campaign_end_date: endDate || null,
            budget: budget ? Number(budget) : null,
            ad_spending: adSpending ? Number(adSpending) : 0,
            impressions: impressions ? Number(impressions) : 0,
            clicks: clicks ? Number(clicks) : 0,
            external_url: externalUrl || null,
          }),
        }
      );
      router.push(`/app/campaigns?campaign=${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save campaign"
      );
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (editId) {
      router.push(`/app/campaigns?campaign=${editId}`);
      return;
    }
    if (duplicateId) {
      router.push(`/app/campaigns?campaign=${duplicateId}`);
      return;
    }
    router.push("/app/campaigns");
  }

  const title = isEditMode
    ? "Edit Campaign"
    : duplicateId
      ? "Duplicate Campaign"
      : "Campaign Details";
  const description = isEditMode
    ? "Update campaign setup and external campaign link."
    : duplicateId
      ? "Create a draft copy. Generated metrics start from zero unless you enter new values."
      : "Create a draft campaign that can be attributed to new and existing leads.";

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>

        {loadingSource ? (
          <p className="mt-4 text-sm text-slate-500">Loading campaign...</p>
        ) : null}
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

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Campaign URL
            </span>
            <input
              type="url"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="https://www.facebook.com/..."
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="block text-xs text-slate-500">
              Optional. Paste the external campaign link to show a View on platform action.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">
          Campaign Content
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Need copy for Facebook, Instagram, TikTok, WhatsApp, or email? Use a content template, copy the generated text, and paste it into the external platform.
        </p>
        <Link
          href="/app/campaigns/templates"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Use a template
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">
          Budget and Metrics
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {duplicateId
            ? "Metric fields are blank for draft copies so past performance is not carried over."
            : "Optional starting values. Campaign counters update as leads convert."}
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
          onClick={cancel}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || loadingSource || !name}
          className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving
            ? "Saving..."
            : isEditMode
              ? "Save Campaign"
              : duplicateId
                ? "Create Draft Copy"
                : "Create Campaign"}
        </button>
      </div>
    </form>
  );
}

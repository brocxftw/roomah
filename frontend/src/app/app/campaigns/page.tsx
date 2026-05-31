"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  campaign_start_date: string;
  campaign_end_date?: string | null;
  ad_spending: string | number;
  budget?: string | number | null;
  leads_generated: number;
  conversions: number;
};

export default function CampaignsPage() {
  const { getToken } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaigns() {
      const token = await getToken();
      const data = await apiFetch<Campaign[]>(
        "/campaigns?include_completed=true&include_draft=true",
        token
      );
      setCampaigns(data);
      setError(null);
    }

    void loadCampaigns().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    });
  }, [getToken]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Campaigns</h2>
          <p className="text-sm text-slate-500">
            Review marketing campaigns and create new lead sources.
          </p>
        </div>
        <Link
          href="/app/campaigns/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          + Add Campaign
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="grid gap-3 border-b border-slate-200 p-4 text-sm last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-950 dark:text-slate-50">
                {campaign.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Starts{" "}
                {new Date(campaign.campaign_start_date).toLocaleDateString()}
              </p>
            </div>
            <span>{campaign.channel}</span>
            <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {campaign.status}
            </span>
            <span>RM {campaign.ad_spending}</span>
            <span>{campaign.leads_generated} leads</span>
            <span>{campaign.conversions} conversions</span>
          </div>
        ))}
        {!campaigns.length ? (
          <p className="p-4 text-sm text-slate-500">No campaigns found.</p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

export type CampaignSummary = {
  id: string;
  name: string;
  channel: string;
  status: string;
};

type CampaignPickerProps = {
  value: string | null;
  onChange: (campaignId: string | null) => void;
  label?: string;
  includeAllToggle?: boolean;
};

export function CampaignPicker({
  value,
  onChange,
  label = "Marketing campaign",
  includeAllToggle = true,
}: CampaignPickerProps) {
  const { getToken } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaigns() {
      const token = await getToken();
      const params = new URLSearchParams();
      if (showAll) {
        params.set("include_completed", "true");
        params.set("include_draft", "true");
      }
      const data = await apiFetch<CampaignSummary[]>(
        `/campaigns${params.size ? `?${params.toString()}` : ""}`,
        token
      );
      setCampaigns(data);
      setError(null);
    }

    void loadCampaigns().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    });
  }, [getToken, showAll]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="">Unattributed</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaign.channel}, {campaign.status})
            </option>
          ))}
        </select>
      </label>
      {includeAllToggle ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Show drafts and completed campaigns
        </label>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

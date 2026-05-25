"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  preferred_location?: string | null;
  campaign_name?: string | null;
  campaign?: {
    name: string;
    channel: string;
    status: string;
  } | null;
  ren?: {
    email: string;
    full_name: string;
  } | null;
};

export default function LeadsPage() {
  const { getToken } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeads() {
      const token = await getToken();
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status_filter", status);

      try {
        const data = await apiFetch<Lead[]>(
          `/leads${params.size ? `?${params.toString()}` : ""}`,
          token
        );
        setLeads(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leads");
      }
    }

    void loadLeads();
  }, [getToken, query, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Leads</h2>
          <p className="text-muted-foreground">
            Search customers, review statuses, and open lead workflows.
          </p>
        </div>
        <Link
          href="/app/leads/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add Lead
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, phone, or email"
          className="w-full rounded-md border px-3 py-2"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-md border px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Negotiating">Negotiating</option>
          <option value="Closed">Closed</option>
          <option value="Lost">Lost</option>
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/app/leads/${lead.id}`}
            className="grid grid-cols-6 gap-4 border-b p-4 last:border-b-0 hover:bg-muted"
          >
            <span className="font-medium">{lead.name}</span>
            <span>{lead.phone}</span>
            <span>{lead.email}</span>
            <span>
              {lead.campaign ? (
                <>
                  <span className="block">{lead.campaign.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {lead.campaign.channel}
                  </span>
                </>
              ) : (
                "Unattributed"
              )}
            </span>
            <span>
              <span className="block">{lead.ren?.full_name ?? "-"}</span>
              <span className="text-xs text-muted-foreground">
                {lead.ren?.email ?? ""}
              </span>
            </span>
            <span>{lead.status}</span>
          </Link>
        ))}
        {!leads.length ? (
          <p className="p-4 text-sm text-muted-foreground">No leads found.</p>
        ) : null}
      </div>
    </div>
  );
}

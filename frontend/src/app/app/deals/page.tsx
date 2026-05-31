"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { isSupportedDealStatusFilter } from "@/lib/workspace-filters";

type Deal = {
  id: string;
  lead_id: string;
  property_id: string;
  sale_price: number;
  commission_total: number;
  commission_override?: number | null;
  closed_at: string;
  ren?: {
    email: string;
    full_name: string;
  } | null;
};

type ClosingLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  last_interaction_at?: string | null;
  ren?: {
    email: string;
    full_name: string;
  } | null;
};

export default function DealsPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [closingLeads, setClosingLeads] = useState<ClosingLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = searchParams.get("status");
  const isClosingFilterActive = isSupportedDealStatusFilter(statusFilter);

  useEffect(() => {
    async function loadDeals() {
      const token = await getToken();
      if (isClosingFilterActive) {
        const data = await apiFetch<ClosingLead[]>(
          "/leads?status_filter=Negotiation",
          token
        );
        setClosingLeads(data);
        setDeals([]);
        return;
      }

      const data = await apiFetch<Deal[]>("/deals", token);
      setDeals(data);
      setClosingLeads([]);
    }

    void loadDeals().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    });
  }, [getToken, isClosingFilterActive]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Deals</h2>
        <p className="text-muted-foreground">
          Won transactions and commission totals.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isClosingFilterActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>Showing negotiation-stage leads that are nearing closing.</span>
          <Link
            href="/app/deals"
            className="font-medium underline underline-offset-4"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        {isClosingFilterActive
          ? closingLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/app/leads/${lead.id}`}
                className="grid grid-cols-6 gap-4 border-b p-4 last:border-b-0 hover:bg-muted"
              >
                <span className="font-medium">{lead.name}</span>
                <span>{lead.phone}</span>
                <span>{lead.email}</span>
                <span>
                  <span className="block">{lead.ren?.full_name ?? "-"}</span>
                  <span className="text-xs text-muted-foreground">
                    {lead.ren?.email ?? ""}
                  </span>
                </span>
                <span>{lead.status}</span>
                <span>
                  {lead.last_interaction_at
                    ? new Date(lead.last_interaction_at).toLocaleDateString()
                    : "No recent interaction"}
                </span>
              </Link>
            ))
          : deals.map((deal) => (
              <div
                key={deal.id}
                className="grid grid-cols-6 gap-4 border-b p-4 last:border-b-0"
              >
                <span>{new Date(deal.closed_at).toLocaleDateString()}</span>
                <span>Lead {deal.lead_id}</span>
                <span>Property {deal.property_id}</span>
                <span>
                  <span className="block">{deal.ren?.full_name ?? "-"}</span>
                  <span className="text-xs text-muted-foreground">
                    {deal.ren?.email ?? ""}
                  </span>
                </span>
                <span>RM {deal.sale_price}</span>
                <span>RM {deal.commission_override ?? deal.commission_total}</span>
              </div>
            ))}
        {isClosingFilterActive && !closingLeads.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            No closing opportunities found.
          </p>
        ) : null}
        {!isClosingFilterActive && !deals.length ? (
          <p className="p-4 text-sm text-muted-foreground">No deals closed.</p>
        ) : null}
      </div>
    </div>
  );
}

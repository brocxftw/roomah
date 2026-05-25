"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Deal = {
  id: string;
  lead_id: string;
  property_id: string;
  sale_price: number;
  commission_total: number;
  commission_override?: number | null;
  closed_at: string;
};

export default function DealsPage() {
  const { getToken } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeals() {
      const token = await getToken();
      const data = await apiFetch<Deal[]>("/deals", token);
      setDeals(data);
    }

    void loadDeals().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    });
  }, [getToken]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Deals</h2>
        <p className="text-muted-foreground">
          Closed transactions and commission totals.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border">
        {deals.map((deal) => (
          <div
            key={deal.id}
            className="grid grid-cols-5 gap-4 border-b p-4 last:border-b-0"
          >
            <span>{new Date(deal.closed_at).toLocaleDateString()}</span>
            <span>Lead {deal.lead_id}</span>
            <span>Property {deal.property_id}</span>
            <span>RM {deal.sale_price}</span>
            <span>RM {deal.commission_override ?? deal.commission_total}</span>
          </div>
        ))}
        {!deals.length ? (
          <p className="p-4 text-sm text-muted-foreground">No deals closed.</p>
        ) : null}
      </div>
    </div>
  );
}

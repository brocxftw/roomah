"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type ManagerRow = {
  ren_id: string;
  ren_name: string;
  active_leads: number;
  pipeline: Record<string, number>;
  viewing_count: number;
  commission: string;
  monthly_trend: string;
};

export default function ManagerDashboardPage() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const token = await getToken();
      const data = await apiFetch<ManagerRow[]>("/manager/dashboard", token);
      setRows(data);
    }

    void loadDashboard().catch((err) => {
      setError(
        err instanceof Error ? err.message : "Failed to load manager dashboard"
      );
    });
  }, [getToken]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Team Manager Dashboard
        </h2>
        <p className="text-muted-foreground">
          Team pipeline, viewings, commission, and monthly trends.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border">
        {rows.map((row) => (
          <div
            key={row.ren_id}
            className="grid grid-cols-6 gap-4 border-b p-4 text-sm last:border-b-0"
          >
            <Link
              href={`/app/manager/ren/${row.ren_id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.ren_name}
            </Link>
            <span>{row.active_leads} active</span>
            <span>
              A {row.pipeline.Active ?? 0} / N {row.pipeline.Negotiating ?? 0} /
              C {row.pipeline.Closed ?? 0} / L {row.pipeline.Lost ?? 0}
            </span>
            <span>{row.viewing_count} viewings</span>
            <span>RM {row.commission}</span>
            <span>Trend RM {row.monthly_trend}</span>
          </div>
        ))}
        {!rows.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            No team members found.
          </p>
        ) : null}
      </div>
    </div>
  );
}

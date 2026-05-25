"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type ManagerRow = {
  ren_id: string;
  ren_name: string;
  ren_email: string;
  ren_phone_number?: string | null;
  ren_active_status: boolean;
  active_leads: number;
  pipeline: Record<string, number>;
  viewing_count: number;
  commission: string;
  monthly_trend: string;
};

export default function ManagerDashboardPage() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [editingRows, setEditingRows] = useState<
    Record<string, { full_name: string; phone_number: string }>
  >({});
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    const token = await getToken();
    const data = await apiFetch<ManagerRow[]>("/manager/dashboard", token);
    setRows(data);
    setEditingRows(
      Object.fromEntries(
        data.map((row) => [
          row.ren_id,
          {
            full_name: row.ren_name,
            phone_number: row.ren_phone_number ?? "",
          },
        ])
      )
    );
  }

  useEffect(() => {
    void loadDashboard().catch((err) => {
      setError(
        err instanceof Error ? err.message : "Failed to load manager dashboard"
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  async function updateTeamMember(
    renId: string,
    payload: { full_name?: string; phone_number?: string | null; active_status?: boolean }
  ) {
    const token = await getToken();
    await apiFetch(`/users/${renId}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await loadDashboard();
  }

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
            className="grid grid-cols-8 gap-4 border-b p-4 text-sm last:border-b-0"
          >
            <div>
              <Link
                href={`/app/manager/ren/${row.ren_id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {row.ren_name}
              </Link>
              <p className="text-xs text-muted-foreground">{row.ren_email}</p>
            </div>
            <input
              value={editingRows[row.ren_id]?.full_name ?? row.ren_name}
              onChange={(event) =>
                setEditingRows((current) => ({
                  ...current,
                  [row.ren_id]: {
                    full_name: event.target.value,
                    phone_number:
                      current[row.ren_id]?.phone_number ??
                      row.ren_phone_number ??
                      "",
                  },
                }))
              }
              className="rounded-md border px-2 py-1"
            />
            <input
              value={
                editingRows[row.ren_id]?.phone_number ??
                row.ren_phone_number ??
                ""
              }
              onChange={(event) =>
                setEditingRows((current) => ({
                  ...current,
                  [row.ren_id]: {
                    full_name: current[row.ren_id]?.full_name ?? row.ren_name,
                    phone_number: event.target.value,
                  },
                }))
              }
              placeholder="Phone"
              className="rounded-md border px-2 py-1"
            />
            <span>{row.active_leads} active</span>
            <span>
              A {row.pipeline.Active ?? 0} / N {row.pipeline.Negotiating ?? 0} /
              C {row.pipeline.Closed ?? 0} / L {row.pipeline.Lost ?? 0}
            </span>
            <span>{row.viewing_count} viewings</span>
            <span>RM {row.commission}</span>
            <div className="space-y-2">
              <span className="block">Trend RM {row.monthly_trend}</span>
              <button
                type="button"
                className="rounded-md border px-2 py-1 text-xs"
                onClick={() =>
                  void updateTeamMember(row.ren_id, {
                    full_name:
                      editingRows[row.ren_id]?.full_name ?? row.ren_name,
                    phone_number:
                      editingRows[row.ren_id]?.phone_number || null,
                  })
                }
              >
                Save
              </button>
              <button
                type="button"
                className="ml-2 rounded-md border px-2 py-1 text-xs"
                onClick={() => {
                  const nextStatus = !row.ren_active_status;
                  if (
                    !nextStatus &&
                    !window.confirm(`Deactivate ${row.ren_name}?`)
                  ) {
                    return;
                  }
                  void updateTeamMember(row.ren_id, {
                    active_status: nextStatus,
                  });
                }}
              >
                {row.ren_active_status ? "Deactivate" : "Reactivate"}
              </button>
            </div>
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

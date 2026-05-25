"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Viewing = {
  id: string;
  lead_id: string;
  property_id: string;
  assigned_ren_id: string;
  scheduled_at: string;
  status: string;
  suggested_follow_up_at?: string;
  assigned_ren?: {
    email: string;
    full_name: string;
  } | null;
};

export default function ViewingsPage() {
  const { getToken } = useAuth();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [completionNotes, setCompletionNotes] = useState<
    Record<string, string>
  >({});
  const [interestLevel, setInterestLevel] = useState<Record<string, string>>(
    {}
  );
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);

  async function loadViewings() {
    const token = await getToken();
    const data = await apiFetch<Viewing[]>("/viewings", token);
    setViewings(data);
  }

  useEffect(() => {
    void loadViewings().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load viewings");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  const completeViewing = async (
    event: FormEvent<HTMLFormElement>,
    viewingId: string
  ) => {
    event.preventDefault();
    const token = await getToken();
    const completed = await apiFetch<Viewing>(
      `/viewings/${viewingId}/complete`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          interest_level: Number(interestLevel[viewingId] ?? "2"),
          notes: completionNotes[viewingId] ?? null,
        }),
      }
    );
    if (completed.suggested_follow_up_at) {
      setSuggestedFollowUps((current) => ({
        ...current,
        [viewingId]: completed.suggested_follow_up_at as string,
      }));
    }
    await loadViewings();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Viewings</h2>
          <p className="text-muted-foreground">
            Schedule viewings and capture post-viewing interest.
          </p>
        </div>
        <Link
          href="/app/viewings/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Schedule Viewing
        </Link>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-4">
        {viewings.map((viewing) => {
          const isPast =
            new Date(viewing.scheduled_at).getTime() <= new Date().getTime();
          return (
            <div key={viewing.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {new Date(viewing.scheduled_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Lead {viewing.lead_id} · Property {viewing.property_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Assigned to {viewing.assigned_ren?.full_name ?? viewing.assigned_ren_id}
                    {viewing.assigned_ren?.email
                      ? ` · ${viewing.assigned_ren.email}`
                      : ""}
                  </p>
                </div>
                <span className="text-sm">{viewing.status}</span>
              </div>

              {isPast && viewing.status === "scheduled" ? (
                <form
                  onSubmit={(event) => void completeViewing(event, viewing.id)}
                  className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]"
                >
                  <select
                    value={interestLevel[viewing.id] ?? "2"}
                    onChange={(event) =>
                      setInterestLevel((current) => ({
                        ...current,
                        [viewing.id]: event.target.value,
                      }))
                    }
                    className="rounded-md border px-3 py-2"
                  >
                    <option value="1">1 star</option>
                    <option value="2">2 stars</option>
                    <option value="3">3 stars</option>
                  </select>
                  <input
                    value={completionNotes[viewing.id] ?? ""}
                    onChange={(event) =>
                      setCompletionNotes((current) => ({
                        ...current,
                        [viewing.id]: event.target.value,
                      }))
                    }
                    placeholder="Completion notes"
                    className="rounded-md border px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Complete
                  </button>
                </form>
              ) : null}
              {suggestedFollowUps[viewing.id] ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Suggested follow-up:{" "}
                  {new Date(suggestedFollowUps[viewing.id]).toLocaleString()}
                </p>
              ) : null}
            </div>
          );
        })}
        {!viewings.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No viewings scheduled.
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

export default function NewViewingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [form, setForm] = useState({
    lead_id: "",
    property_id: "",
    scheduled_at: "",
    assigned_ren_id: "",
  });
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    try {
      await apiFetch("/viewings", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
        }),
      });
      router.push("/app/viewings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Schedule Viewing
        </h2>
        <p className="text-muted-foreground">
          Choose lead, property, date/time, and assigned REN.
        </p>
      </div>

      <input
        value={form.lead_id}
        onChange={(event) => updateField("lead_id", event.target.value)}
        placeholder="Lead UUID"
        className="w-full rounded-md border px-3 py-2"
        required
      />
      <input
        value={form.property_id}
        onChange={(event) => updateField("property_id", event.target.value)}
        placeholder="Property UUID"
        className="w-full rounded-md border px-3 py-2"
        required
      />
      <input
        value={form.scheduled_at}
        onChange={(event) => updateField("scheduled_at", event.target.value)}
        type="datetime-local"
        className="w-full rounded-md border px-3 py-2"
        required
      />
      <input
        value={form.assigned_ren_id}
        onChange={(event) => updateField("assigned_ren_id", event.target.value)}
        placeholder="Assigned REN UUID"
        className="w-full rounded-md border px-3 py-2"
        required
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Save Viewing
      </button>
    </form>
  );
}

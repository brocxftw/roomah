"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { CampaignPicker } from "@/components/campaign-picker";
import { apiFetch } from "@/lib/api";
import {
  MALAYSIAN_STATES,
  suggestCityFromAddress,
} from "@/lib/malaysia-areas";
import { useAuth } from "@/lib/use-auth";

type Lead = {
  id: string;
};

type LeadDetail = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  budget_min?: number | string | null;
  budget_max?: number | string | null;
  preferred_location?: string | null;
  preferred_state?: string | null;
  preferred_city?: string | null;
  preferred_areas?: string[] | null;
  preferred_property_type?: string | null;
  campaign_id?: string | null;
};

const steps = ["Customer Details", "Budget", "Preferences", "Review"];

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  budget_min: "",
  budget_max: "",
  preferred_location: "",
  preferred_state: "",
  preferred_city: "",
  preferred_areas: "",
  preferred_property_type: "",
  campaign_id: null as string | null,
};

export default function NewLeadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editLeadId = searchParams.get("edit");
  const isEditing = Boolean(editLeadId);
  const { getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState<boolean>(isEditing);

  useEffect(() => {
    if (!editLeadId) return;
    let cancelled = false;
    async function loadLead() {
      setLoading(true);
      try {
        const token = await getToken();
        const lead = await apiFetch<LeadDetail>(`/leads/${editLeadId}`, token);
        if (cancelled) return;
        setForm({
          name: lead.name ?? "",
          phone: lead.phone ?? "",
          email: lead.email ?? "",
          budget_min: lead.budget_min ? String(lead.budget_min) : "",
          budget_max: lead.budget_max ? String(lead.budget_max) : "",
          preferred_location: lead.preferred_location ?? "",
          preferred_state: lead.preferred_state ?? "",
          preferred_city: lead.preferred_city ?? "",
          preferred_areas: (lead.preferred_areas ?? []).join(", "),
          preferred_property_type: lead.preferred_property_type ?? "",
          campaign_id: lead.campaign_id ?? null,
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load lead");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadLead();
    return () => {
      cancelled = true;
    };
  }, [editLeadId, getToken]);

  const updateField = (field: keyof typeof form, value: string | null) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updatePreferredLocation = (value: string) => {
    setForm((current) => {
      const suggestedCity = suggestCityFromAddress(value);
      return {
        ...current,
        preferred_location: value,
        preferred_city: current.preferred_city || suggestedCity,
      };
    });
  };

  const canAdvance = () => {
    if (step === 0) return form.name && form.phone && form.email;
    if (step === 1) {
      if (!form.budget_min || !form.budget_max) return true;
      return Number(form.budget_min) <= Number(form.budget_max);
    }
    return true;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      if (!canAdvance()) {
        setError("Please complete the step before continuing.");
        return;
      }
      setError(null);
      setStep((current) => current + 1);
      return;
    }

    const token = await getToken();
    const payload = {
      ...form,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      preferred_location: form.preferred_location || null,
      preferred_state: form.preferred_state || null,
      preferred_city: form.preferred_city || null,
      preferred_areas: form.preferred_areas
        .split(",")
        .map((area) => area.trim())
        .filter(Boolean),
      preferred_property_type: form.preferred_property_type || null,
    };

    try {
      if (isEditing && editLeadId) {
        await apiFetch<Lead>(`/leads/${editLeadId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        router.push(`/app/leads?lead=${editLeadId}`);
      } else {
        const lead = await apiFetch<Lead>("/leads", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        router.push(`/app/leads?lead=${lead.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lead");
    }
  };

  if (loading) {
    return (
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
        Loading lead...
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{steps[step]}</h2>
      </div>

      {step === 0 ? (
        <div className="space-y-4">
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Customer name"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="Phone"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            type="email"
            placeholder="Email"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <CampaignPicker
            value={form.campaign_id}
            onChange={(campaignId) => updateField("campaign_id", campaignId)}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid grid-cols-2 gap-4">
          <input
            value={form.budget_min}
            onChange={(event) => updateField("budget_min", event.target.value)}
            type="number"
            min="0"
            placeholder="Minimum budget"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={form.budget_max}
            onChange={(event) => updateField("budget_max", event.target.value)}
            type="number"
            min="0"
            placeholder="Maximum budget"
            className="rounded-md border px-3 py-2"
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <select
            aria-label="Preferred state"
            value={form.preferred_state}
            onChange={(event) => updateField("preferred_state", event.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">Select preferred state</option>
            {MALAYSIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <input
            value={form.preferred_city}
            onChange={(event) => updateField("preferred_city", event.target.value)}
            placeholder="Preferred city / area"
            className="w-full rounded-md border px-3 py-2"
          />
          <input
            value={form.preferred_areas}
            onChange={(event) => updateField("preferred_areas", event.target.value)}
            placeholder="Preferred areas, separated by commas"
            className="w-full rounded-md border px-3 py-2"
          />
          <textarea
            value={form.preferred_location}
            onChange={(event) => updatePreferredLocation(event.target.value)}
            placeholder="Optional location notes"
            className="min-h-24 w-full rounded-md border px-3 py-2"
          />
          <input
            value={form.preferred_property_type}
            onChange={(event) =>
              updateField("preferred_property_type", event.target.value)
            }
            placeholder="Preferred property type"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3 rounded-lg border bg-muted p-4 text-sm">
          <div>
            <p className="font-medium">Customer</p>
            <p className="text-muted-foreground">
              {form.name} · {form.phone} · {form.email}
            </p>
          </div>
          <div>
            <p className="font-medium">Budget</p>
            <p className="text-muted-foreground">
              {form.budget_min || "-"} - {form.budget_max || "-"}
            </p>
          </div>
          <div>
            <p className="font-medium">Preferences</p>
            <p className="text-muted-foreground">
              {[form.preferred_city, form.preferred_state]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
            <p className="text-muted-foreground">
              Areas: {form.preferred_areas || "-"}
            </p>
            <p className="text-muted-foreground">
              Notes: {form.preferred_location || "-"}
            </p>
            <p className="text-muted-foreground">
              Property type: {form.preferred_property_type || "-"}
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {step === steps.length - 1
            ? isEditing
              ? "Update"
              : "Create Lead"
            : "Continue"}
        </button>
      </div>
    </form>
  );
}

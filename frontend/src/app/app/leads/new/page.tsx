"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { CampaignPicker } from "@/components/campaign-picker";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Lead = {
  id: string;
};

const steps = ["Customer Details", "Budget", "Preferences", "Review"];

export default function NewLeadPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    budget_min: "",
    budget_max: "",
    preferred_location: "",
    preferred_property_type: "",
    campaign_id: null as string | null,
  });

  const updateField = (field: keyof typeof form, value: string | null) => {
    setForm((current) => ({ ...current, [field]: value }));
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
    };
    const lead = await apiFetch<Lead>("/leads", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    router.push(`/app/leads/${lead.id}`);
  };

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
          <input
            value={form.preferred_location}
            onChange={(event) =>
              updateField("preferred_location", event.target.value)
            }
            placeholder="Preferred location"
            className="w-full rounded-md border px-3 py-2"
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
        <pre className="rounded-lg border bg-muted p-4 text-sm">
          {JSON.stringify(form, null, 2)}
        </pre>
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
          {step === steps.length - 1 ? "Create Lead" : "Continue"}
        </button>
      </div>
    </form>
  );
}

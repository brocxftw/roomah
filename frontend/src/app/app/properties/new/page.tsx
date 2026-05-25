"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Property = {
  id: string;
};

const steps = ["Basic Information", "Additional Details", "Images", "Review"];

export default function NewPropertyPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "",
    location: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    furnishing: "",
    cover_storage_path: "",
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      if (
        step === 0 &&
        (!form.name || !form.type || !form.location || !form.price)
      ) {
        setError("Name, type, location, and price are required.");
        return;
      }
      if (step === 2 && !form.cover_storage_path) {
        setError("Cover image storage path is required.");
        return;
      }
      setError(null);
      setStep((current) => current + 1);
      return;
    }

    const token = await getToken();
    const property = await apiFetch<Property>("/properties", token, {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        location: form.location,
        price: Number(form.price),
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        furnishing: form.furnishing || null,
      }),
    });
    await apiFetch(`/properties/${property.id}/images/complete`, token, {
      method: "POST",
      body: JSON.stringify({
        storage_path: form.cover_storage_path,
        is_cover: true,
        sort_order: 0,
      }),
    });
    router.push(`/app/properties/${property.id}`);
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
            placeholder="Property name"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.type}
            onChange={(event) => updateField("type", event.target.value)}
            placeholder="Type"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="Location"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            type="number"
            min="0"
            placeholder="Price"
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid grid-cols-2 gap-4">
          <input
            value={form.bedrooms}
            onChange={(event) => updateField("bedrooms", event.target.value)}
            type="number"
            min="0"
            placeholder="Bedrooms"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={form.bathrooms}
            onChange={(event) => updateField("bathrooms", event.target.value)}
            type="number"
            min="0"
            placeholder="Bathrooms"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={form.sqft}
            onChange={(event) => updateField("sqft", event.target.value)}
            type="number"
            min="0"
            placeholder="Sqft"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={form.furnishing}
            onChange={(event) => updateField("furnishing", event.target.value)}
            placeholder="Furnishing"
            className="rounded-md border px-3 py-2"
          />
        </div>
      ) : null}

      {step === 2 ? (
        <input
          value={form.cover_storage_path}
          onChange={(event) =>
            updateField("cover_storage_path", event.target.value)
          }
          placeholder="Cover image storage path"
          className="w-full rounded-md border px-3 py-2"
          required
        />
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
          {step === steps.length - 1 ? "Create Property" : "Continue"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Property = {
  id: string;
};

type ListingType = "Sale" | "Rental" | "Both";

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
    listing_type: "Sale" as ListingType,
    market_value: "",
    listing_price: "",
    expected_rental: "",
    year_built: "",
    maintenance_fee: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    furnishing: "",
    cover_storage_path: "",
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validatePriceFields = () => {
    if (
      (form.listing_type === "Sale" || form.listing_type === "Both") &&
      !form.listing_price
    ) {
      return "Listing price is required for Sale and Both listings.";
    }
    if (
      (form.listing_type === "Rental" || form.listing_type === "Both") &&
      !form.expected_rental
    ) {
      return "Expected rental is required for Rental and Both listings.";
    }
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      if (step === 0 && (!form.name || !form.type || !form.location)) {
        setError("Name, type, location, and listing type are required.");
        return;
      }
      if (step === 1) {
        const priceError = validatePriceFields();
        if (priceError) {
          setError(priceError);
          return;
        }
      }
      if (step === 1 && form.year_built) {
        const yearBuilt = Number(form.year_built);
        const currentYear = new Date().getFullYear();
        if (yearBuilt < 1900 || yearBuilt > currentYear) {
          setError(`Year built must be between 1900 and ${currentYear}.`);
          return;
        }
      }
      if (step === 1 && form.maintenance_fee && Number(form.maintenance_fee) < 0) {
        setError("Maintenance fee must be non-negative.");
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
        listing_type: form.listing_type,
        market_value: form.market_value ? Number(form.market_value) : null,
        listing_price: form.listing_price ? Number(form.listing_price) : null,
        expected_rental: form.expected_rental
          ? Number(form.expected_rental)
          : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        maintenance_fee: form.maintenance_fee
          ? Number(form.maintenance_fee)
          : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        furnishing: form.furnishing || null,
      }),
    });
    await apiFetch(`/properties/${property.id}/images/complete`, token, {
      method: "POST",
      body: JSON.stringify({
        storage_path: form.cover_storage_path.includes("/")
          ? form.cover_storage_path
          : `local/${property.id}/${form.cover_storage_path}`,
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
          <select
            value={form.listing_type}
            onChange={(event) =>
              updateField("listing_type", event.target.value as ListingType)
            }
            className="w-full rounded-md border px-3 py-2"
            required
          >
            <option value="Sale">Sale</option>
            <option value="Rental">Rental</option>
            <option value="Both">Both</option>
          </select>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid grid-cols-2 gap-4">
          {(form.listing_type === "Sale" || form.listing_type === "Both") ? (
            <input
              value={form.listing_price}
              onChange={(event) =>
                updateField("listing_price", event.target.value)
              }
              type="number"
              min="0"
              placeholder="Listing price"
              className="rounded-md border px-3 py-2"
              required
            />
          ) : null}
          {(form.listing_type === "Rental" || form.listing_type === "Both") ? (
            <input
              value={form.expected_rental}
              onChange={(event) =>
                updateField("expected_rental", event.target.value)
              }
              type="number"
              min="0"
              placeholder="Expected rental"
              className="rounded-md border px-3 py-2"
              required
            />
          ) : null}
          <input
            value={form.market_value}
            onChange={(event) => updateField("market_value", event.target.value)}
            type="number"
            min="0"
            placeholder="Market value"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={form.year_built}
            onChange={(event) => updateField("year_built", event.target.value)}
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            placeholder="Year built"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={form.maintenance_fee}
            onChange={(event) =>
              updateField("maintenance_fee", event.target.value)
            }
            type="number"
            min="0"
            placeholder="Maintenance fee"
            className="rounded-md border px-3 py-2"
          />
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

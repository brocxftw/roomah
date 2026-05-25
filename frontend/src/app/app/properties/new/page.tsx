"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/api";
import {
  MALAYSIAN_STATES,
  suggestCityFromAddress,
} from "@/lib/malaysia-areas";
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
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postcode: "",
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

  const updateAddressField = (
    field: "address_line_1" | "address_line_2",
    value: string
  ) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      const suggestedCity = suggestCityFromAddress(
        next.address_line_1,
        next.address_line_2
      );

      return {
        ...next,
        city: current.city || suggestedCity,
      };
    });
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
      if (
        step === 0 &&
        (!form.name ||
          !form.type ||
          !form.owner_name ||
          !form.owner_email ||
          !form.owner_phone ||
          !form.address_line_1 ||
          !form.city ||
          !form.state ||
          !form.postcode)
      ) {
        setError("Property, owner, and address details are required.");
        return;
      }
      if (step === 0 && !/^\d{5}$/.test(form.postcode)) {
        setError("Postcode must be 5 digits.");
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
        owner_name: form.owner_name,
        owner_email: form.owner_email,
        owner_phone: form.owner_phone,
        address_line_1: form.address_line_1,
        address_line_2: form.address_line_2 || null,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
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
    if (form.cover_storage_path) {
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
    }
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
            value={form.owner_name}
            onChange={(event) => updateField("owner_name", event.target.value)}
            placeholder="Owner name"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.owner_email}
            onChange={(event) => updateField("owner_email", event.target.value)}
            type="email"
            placeholder="Owner email"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.owner_phone}
            onChange={(event) => updateField("owner_phone", event.target.value)}
            placeholder="Owner phone"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.address_line_1}
            onChange={(event) =>
              updateAddressField("address_line_1", event.target.value)
            }
            placeholder="Address line 1"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <input
            value={form.address_line_2}
            onChange={(event) =>
              updateAddressField("address_line_2", event.target.value)
            }
            placeholder="Address line 2"
            className="w-full rounded-md border px-3 py-2"
          />
          <input
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="City / Area"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <select
            aria-label="State"
            value={form.state}
            onChange={(event) => updateField("state", event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            required
          >
            <option value="">Select state</option>
            {MALAYSIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <input
            value={form.postcode}
            onChange={(event) => updateField("postcode", event.target.value)}
            inputMode="numeric"
            pattern="\d{5}"
            placeholder="Postcode"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <select
            aria-label="Listing type"
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
        <div className="space-y-2">
          <input
            value={form.cover_storage_path}
            onChange={(event) =>
              updateField("cover_storage_path", event.target.value)
            }
            placeholder="Optional cover image storage path"
            className="w-full rounded-md border px-3 py-2"
          />
          <p className="text-sm text-muted-foreground">
            Images are optional on web. Add a storage path only if an image is
            already uploaded.
          </p>
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
          {step === steps.length - 1 ? "Create Property" : "Continue"}
        </button>
      </div>
    </form>
  );
}

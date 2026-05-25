"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { propertyAddressSummary } from "@/lib/malaysia-areas";
import { useAuth } from "@/lib/use-auth";

type PropertyImage = {
  id: string;
  storage_path: string;
  is_cover: boolean;
  sort_order: number;
};

type PropertyDetail = {
  id: string;
  name: string;
  type: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postcode: string;
  price: number;
  listing_type: "Sale" | "Rental" | "Both";
  market_value?: number | null;
  listing_price?: number | null;
  expected_rental?: number | null;
  year_built?: number | null;
  maintenance_fee?: number | null;
  status: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  furnishing?: string | null;
  description?: string | null;
  images: PropertyImage[];
};

type PropertyEditForm = {
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postcode: string;
  listing_type: "Sale" | "Rental" | "Both";
  market_value: string;
  listing_price: string;
  expected_rental: string;
  year_built: string;
  maintenance_fee: string;
};

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { getToken } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [editForm, setEditForm] = useState<PropertyEditForm | null>(null);
  const [newImagePath, setNewImagePath] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadProperty() {
    const token = await getToken();
    const data = await apiFetch<PropertyDetail>(
      `/properties/${propertyId}`,
      token
    );
    setProperty(data);
    setEditForm({
      owner_name: data.owner_name,
      owner_email: data.owner_email,
      owner_phone: data.owner_phone,
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2 ?? "",
      city: data.city,
      state: data.state,
      postcode: data.postcode,
      listing_type: data.listing_type,
      market_value: data.market_value?.toString() ?? "",
      listing_price: data.listing_price?.toString() ?? "",
      expected_rental: data.expected_rental?.toString() ?? "",
      year_built: data.year_built?.toString() ?? "",
      maintenance_fee: data.maintenance_fee?.toString() ?? "",
    });
  }

  useEffect(() => {
    void loadProperty().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load property");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, getToken]);

  const updateStatus = async (status: string) => {
    const token = await getToken();
    await apiFetch(`/properties/${propertyId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadProperty();
  };

  const updateEditField = (field: keyof PropertyEditForm, value: string) => {
    setEditForm((current) =>
      current ? { ...current, [field]: value } : current
    );
  };

  const updateDomainFields = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm) return;

    const token = await getToken();
    await apiFetch(`/properties/${propertyId}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        owner_name: editForm.owner_name,
        owner_email: editForm.owner_email,
        owner_phone: editForm.owner_phone,
        address_line_1: editForm.address_line_1,
        address_line_2: editForm.address_line_2 || null,
        city: editForm.city,
        state: editForm.state,
        postcode: editForm.postcode,
        listing_type: editForm.listing_type,
        market_value: editForm.market_value ? Number(editForm.market_value) : null,
        listing_price: editForm.listing_price
          ? Number(editForm.listing_price)
          : null,
        expected_rental: editForm.expected_rental
          ? Number(editForm.expected_rental)
          : null,
        year_built: editForm.year_built ? Number(editForm.year_built) : null,
        maintenance_fee: editForm.maintenance_fee
          ? Number(editForm.maintenance_fee)
          : null,
      }),
    });
    await loadProperty();
  };

  const registerImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    await apiFetch(`/properties/${propertyId}/images/complete`, token, {
      method: "POST",
      body: JSON.stringify({
        storage_path: newImagePath,
        is_cover: !property?.images.length,
        sort_order: property?.images.length ?? 0,
      }),
    });
    setNewImagePath("");
    await loadProperty();
  };

  const setCover = async (imageId: string) => {
    const token = await getToken();
    await apiFetch(`/properties/${propertyId}/images/${imageId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ is_cover: true }),
    });
    await loadProperty();
  };

  if (!property) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading property..."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {property.name}
          </h2>
          <p className="text-muted-foreground">
            {property.type} · {propertyAddressSummary(property)} ·{" "}
            {property.listing_type}
          </p>
        </div>
        <select
          value={property.status}
          onChange={(event) => void updateStatus(event.target.value)}
          className="rounded-md border px-3 py-2"
        >
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <section className="rounded-lg border p-4">
        <h3 className="font-medium">Details</h3>
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{property.owner_name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Owner email</dt>
            <dd>{property.owner_email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Owner phone</dt>
            <dd>{property.owner_phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Address</dt>
            <dd>
              {[property.address_line_1, property.address_line_2]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">City / Area</dt>
            <dd>{property.city}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">State</dt>
            <dd>{property.state}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Postcode</dt>
            <dd>{property.postcode}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Listing type</dt>
            <dd>{property.listing_type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Market value</dt>
            <dd>
              {property.market_value != null ? `RM ${property.market_value}` : "-"}
            </dd>
          </div>
          {property.listing_type !== "Rental" ? (
            <div>
              <dt className="text-muted-foreground">Listing price</dt>
              <dd>
                {property.listing_price != null
                  ? `RM ${property.listing_price}`
                  : "-"}
              </dd>
            </div>
          ) : null}
          {property.listing_type !== "Sale" ? (
            <div>
              <dt className="text-muted-foreground">Expected rental</dt>
              <dd>
                {property.expected_rental != null
                  ? `RM ${property.expected_rental}`
                  : "-"}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Year built</dt>
            <dd>{property.year_built ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Maintenance fee</dt>
            <dd>
              {property.maintenance_fee != null
                ? `RM ${property.maintenance_fee}`
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bedrooms</dt>
            <dd>{property.bedrooms ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bathrooms</dt>
            <dd>{property.bathrooms ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sqft</dt>
            <dd>{property.sqft ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Furnishing</dt>
            <dd>{property.furnishing ?? "-"}</dd>
          </div>
        </dl>
      </section>

      {editForm ? (
        <form onSubmit={updateDomainFields} className="rounded-lg border p-4">
          <h3 className="font-medium">Edit Listing Details</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={editForm.owner_name}
              onChange={(event) =>
                updateEditField("owner_name", event.target.value)
              }
              placeholder="Owner name"
              className="rounded-md border px-3 py-2"
              required
            />
            <input
              value={editForm.owner_email}
              onChange={(event) =>
                updateEditField("owner_email", event.target.value)
              }
              type="email"
              placeholder="Owner email"
              className="rounded-md border px-3 py-2"
              required
            />
            <input
              value={editForm.owner_phone}
              onChange={(event) =>
                updateEditField("owner_phone", event.target.value)
              }
              placeholder="Owner phone"
              className="rounded-md border px-3 py-2"
              required
            />
            <input
              value={editForm.address_line_1}
              onChange={(event) =>
                updateEditField("address_line_1", event.target.value)
              }
              placeholder="Address line 1"
              className="rounded-md border px-3 py-2"
              required
            />
            <input
              value={editForm.address_line_2}
              onChange={(event) =>
                updateEditField("address_line_2", event.target.value)
              }
              placeholder="Address line 2"
              className="rounded-md border px-3 py-2"
            />
            <input
              value={editForm.city}
              onChange={(event) => updateEditField("city", event.target.value)}
              placeholder="City / Area"
              className="rounded-md border px-3 py-2"
              required
            />
            <input
              value={editForm.state}
              onChange={(event) => updateEditField("state", event.target.value)}
              placeholder="State"
              className="rounded-md border px-3 py-2"
              required
            />
            <input
              value={editForm.postcode}
              onChange={(event) =>
                updateEditField("postcode", event.target.value)
              }
              inputMode="numeric"
              pattern="\d{5}"
              placeholder="Postcode"
              className="rounded-md border px-3 py-2"
              required
            />
            <select
              value={editForm.listing_type}
              onChange={(event) =>
                updateEditField(
                  "listing_type",
                  event.target.value as PropertyEditForm["listing_type"]
                )
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="Sale">Sale</option>
              <option value="Rental">Rental</option>
              <option value="Both">Both</option>
            </select>
            {(editForm.listing_type === "Sale" ||
              editForm.listing_type === "Both") ? (
              <input
                value={editForm.listing_price}
                onChange={(event) =>
                  updateEditField("listing_price", event.target.value)
                }
                type="number"
                min="0"
                placeholder="Listing price"
                className="rounded-md border px-3 py-2"
              />
            ) : null}
            {(editForm.listing_type === "Rental" ||
              editForm.listing_type === "Both") ? (
              <input
                value={editForm.expected_rental}
                onChange={(event) =>
                  updateEditField("expected_rental", event.target.value)
                }
                type="number"
                min="0"
                placeholder="Expected rental"
                className="rounded-md border px-3 py-2"
              />
            ) : null}
            <input
              value={editForm.market_value}
              onChange={(event) =>
                updateEditField("market_value", event.target.value)
              }
              type="number"
              min="0"
              placeholder="Market value"
              className="rounded-md border px-3 py-2"
            />
            <input
              value={editForm.year_built}
              onChange={(event) =>
                updateEditField("year_built", event.target.value)
              }
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              placeholder="Year built"
              className="rounded-md border px-3 py-2"
            />
            <input
              value={editForm.maintenance_fee}
              onChange={(event) =>
                updateEditField("maintenance_fee", event.target.value)
              }
              type="number"
              min="0"
              placeholder="Maintenance fee"
              className="rounded-md border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Save Listing Details
          </button>
        </form>
      ) : null}

      <form onSubmit={registerImage} className="rounded-lg border p-4">
        <h3 className="font-medium">Gallery Images</h3>
        <div className="mt-4 flex gap-2">
          <input
            value={newImagePath}
            onChange={(event) => setNewImagePath(event.target.value)}
            placeholder="Storage path"
            className="w-full rounded-md border px-3 py-2"
            required
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Register
          </button>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-3">
        {property.images.map((image) => (
          <div key={image.id} className="rounded-lg border p-4">
            <p className="break-all text-sm">{image.storage_path}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {image.is_cover ? "Cover image" : "Gallery image"}
            </p>
            {!image.is_cover ? (
              <button
                type="button"
                onClick={() => void setCover(image.id)}
                className="mt-3 rounded-md border px-3 py-2 text-sm"
              >
                Set as cover
              </button>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}

"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
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
  location: string;
  price: number;
  status: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  furnishing?: string | null;
  description?: string | null;
  images: PropertyImage[];
};

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { getToken } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [newImagePath, setNewImagePath] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadProperty() {
    const token = await getToken();
    const data = await apiFetch<PropertyDetail>(
      `/properties/${propertyId}`,
      token
    );
    setProperty(data);
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
            {property.type} · {property.location} · RM {property.price}
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

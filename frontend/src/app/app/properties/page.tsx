"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Property = {
  id: string;
  name: string;
  type: string;
  location: string;
  price: number;
  listing_type: "Sale" | "Rental" | "Both";
  listing_price?: number | null;
  expected_rental?: number | null;
  status: string;
};

export default function PropertiesPage() {
  const { getToken } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [listingType, setListingType] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProperties() {
      const token = await getToken();
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status_filter", status);
      if (listingType) params.set("listing_type", listingType);

      try {
        const data = await apiFetch<Property[]>(
          `/properties${params.size ? `?${params.toString()}` : ""}`,
          token
        );
        setProperties(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load properties"
        );
      }
    }

    void loadProperties();
  }, [getToken, query, status, listingType]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Properties</h2>
          <p className="text-muted-foreground">
            Search listings and keep inventory status current.
          </p>
        </div>
        <Link
          href="/app/properties/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add Property
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or location"
          className="w-full rounded-md border px-3 py-2"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-md border px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select
          value={listingType}
          onChange={(event) => setListingType(event.target.value)}
          className="rounded-md border px-3 py-2"
        >
          <option value="">All listing types</option>
          <option value="Sale">Sale</option>
          <option value="Rental">Rental</option>
          <option value="Both">Both</option>
          <option value="Sale,Both">Sale-capable</option>
          <option value="Rental,Both">Rental-capable</option>
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border">
        {properties.map((property) => (
          <Link
            key={property.id}
            href={`/app/properties/${property.id}`}
            className="grid grid-cols-6 gap-4 border-b p-4 last:border-b-0 hover:bg-muted"
          >
            <span className="font-medium">{property.name}</span>
            <span>{property.type}</span>
            <span>{property.location}</span>
            <span>
              {property.listing_type === "Rental"
                ? `Rent RM ${property.expected_rental ?? property.price}`
                : `RM ${property.listing_price ?? property.price}`}
            </span>
            <span>{property.status}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs">
              {property.listing_type}
            </span>
          </Link>
        ))}
        {!properties.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            No properties found.
          </p>
        ) : null}
      </div>
    </div>
  );
}

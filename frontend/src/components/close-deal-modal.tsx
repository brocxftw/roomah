"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

import { RecordPicker, type RecordPickerGroup } from "./record-picker";

type ListingType = "Sale" | "Rental" | "Both";

export type CloseDealProperty = {
  id: string;
  name: string;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  listing_type: ListingType;
  status?: string | null;
  listing_price?: number | string | null;
  expected_rental?: number | string | null;
};

export type CloseDealLead = {
  id: string;
  name: string;
  linked_properties: {
    status: string;
    properties: CloseDealProperty;
  }[];
};

export function CloseDealModal({
  open,
  lead,
  propertyGroups,
  preselectedPropertyId,
  onClose,
  onComplete,
  getToken,
}: {
  open: boolean;
  lead: CloseDealLead;
  propertyGroups: RecordPickerGroup[];
  preselectedPropertyId?: string | null;
  onClose: () => void;
  onComplete: () => Promise<void>;
  getToken: () => Promise<string | null>;
}) {
  const [dealPropertyId, setDealPropertyId] = useState("");
  const [dealType, setDealType] = useState<"Sale" | "Rental">("Sale");
  const [salePrice, setSalePrice] = useState("");
  const [agencyFee, setAgencyFee] = useState("");
  const [lawyerFees, setLawyerFees] = useState("");
  const [commissionOverride, setCommissionOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const linkedProperties = lead.linked_properties
    .filter((link) => link.status === "active")
    .map((link) => link.properties);
  const selectedProperty = linkedProperties.find(
    (property) => property.id === dealPropertyId
  );

  useEffect(() => {
    if (!open) return;
    if (dealPropertyId) return;
    const fallbackPropertyId = preselectedPropertyId ?? linkedProperties[0]?.id;
    if (fallbackPropertyId) selectDealProperty(fallbackPropertyId);
    // selectDealProperty derives local state from current linkedProperties.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedPropertyId, linkedProperties, dealPropertyId]);

  function selectDealProperty(propertyId: string) {
    setDealPropertyId(propertyId);
    const property = linkedProperties.find((item) => item.id === propertyId);
    if (!property) return;
    const nextDealType = property.listing_type === "Rental" ? "Rental" : "Sale";
    setDealType(nextDealType);
    setSalePrice(
      String(
        nextDealType === "Rental"
          ? property.expected_rental ?? ""
          : property.listing_price ?? ""
      )
    );
  }

  function updateDealType(nextDealType: "Sale" | "Rental") {
    setDealType(nextDealType);
    if (!selectedProperty) return;
    setSalePrice(
      String(
        nextDealType === "Rental"
          ? selectedProperty.expected_rental ?? ""
          : selectedProperty.listing_price ?? ""
      )
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getToken();
    try {
      await apiFetch("/deals", token, {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead.id,
          property_id: dealPropertyId,
          deal_type: dealType,
          sale_price: Number(salePrice),
          agency_fee: agencyFee ? Number(agencyFee) : null,
          lawyer_fees: lawyerFees ? Number(lawyerFees) : null,
          commission_override: commissionOverride
            ? Number(commissionOverride)
            : null,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close deal");
      return;
    }
    setDealPropertyId("");
    setSalePrice("");
    setAgencyFee("");
    setLawyerFees("");
    setCommissionOverride("");
    setError(null);
    await onComplete();
  }

  if (!open) return null;

  return (
    <div
      data-lead-modal="true"
      data-conversion-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Close deal</h3>
            <p className="text-sm text-slate-500">{lead.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
        <RecordPicker
          label="Linked property"
          value={dealPropertyId}
          onChange={selectDealProperty}
          groups={propertyGroups}
          placeholder="Select linked property"
          searchPlaceholder="Search linked property"
          required
        />
        {selectedProperty?.listing_type === "Both" ? (
          <div className="flex items-center gap-4 rounded-lg border px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={dealType === "Sale"}
                onChange={() => updateDealType("Sale")}
              />
              Sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={dealType === "Rental"}
                onChange={() => updateDealType("Rental")}
              />
              Rental
            </label>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={salePrice}
            onChange={(event) => setSalePrice(event.target.value)}
            type="number"
            min="0"
            placeholder="Final sale/rental amount"
            className="rounded-lg border px-3 py-2"
            required
          />
          <input
            value={agencyFee}
            onChange={(event) => setAgencyFee(event.target.value)}
            type="number"
            min="0"
            placeholder="Agency fee override"
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={lawyerFees}
            onChange={(event) => setLawyerFees(event.target.value)}
            type="number"
            min="0"
            placeholder="Lawyer fees override"
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={commissionOverride}
            onChange={(event) => setCommissionOverride(event.target.value)}
            type="number"
            min="0"
            placeholder="Commission override"
            className="rounded-lg border px-3 py-2"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Close deal
        </button>
      </form>
    </div>
  );
}

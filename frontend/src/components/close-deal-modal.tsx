"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from "react";
import type React from "react";

import { apiFetch } from "@/lib/api";

import { RecordPicker, type RecordPickerGroup } from "./record-picker";

type ListingType = "Sale" | "Rental" | "Both";
type DealType = "Sale" | "Rental";

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

type BaseDealModalProps = {
  open: boolean;
  lead: CloseDealLead;
  propertyGroups: RecordPickerGroup[];
  preselectedPropertyId?: string | null;
  originViewingId?: string | null;
  initialNotes?: string | null;
  onClose: () => void;
  onComplete: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

function activeProperties(lead: CloseDealLead) {
  return lead.linked_properties
    .filter((link) => link.status === "active")
    .map((link) => link.properties);
}

function defaultDealType(property: CloseDealProperty | undefined): DealType {
  return property?.listing_type === "Rental" ? "Rental" : "Sale";
}

function defaultValue(property: CloseDealProperty | undefined, dealType: DealType) {
  if (!property) return "";
  return String(
    dealType === "Rental"
      ? property.expected_rental ?? ""
      : property.listing_price ?? ""
  );
}

function DealTypePicker({
  selectedProperty,
  dealType,
  onChange,
}: {
  selectedProperty?: CloseDealProperty;
  dealType: DealType;
  onChange: (value: DealType) => void;
}) {
  if (selectedProperty?.listing_type !== "Both") return null;
  return (
    <div className="flex items-center gap-4 rounded-lg border px-3 py-2">
      {(["Sale", "Rental"] as const).map((value) => (
        <label key={value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={dealType === value}
            onChange={() => onChange(value)}
          />
          {value}
        </label>
      ))}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  onSubmit,
  error,
  submitLabel,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-lead-modal="true"
      data-conversion-modal="true"
      data-deal-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
        {children}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}

export function CreateDealModal({
  open,
  lead,
  propertyGroups,
  preselectedPropertyId,
  originViewingId,
  initialNotes,
  onClose,
  onComplete,
  getToken,
}: BaseDealModalProps) {
  const linkedProperties = useMemo(() => activeProperties(lead), [lead]);
  const [dealPropertyId, setDealPropertyId] = useState("");
  const [dealType, setDealType] = useState<DealType>("Sale");
  const [salePrice, setSalePrice] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [probabilityOverride, setProbabilityOverride] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const selectedProperty = linkedProperties.find(
    (property) => property.id === dealPropertyId
  );

  function selectDealProperty(propertyId: string) {
    setDealPropertyId(propertyId);
    const property = linkedProperties.find((item) => item.id === propertyId);
    const nextDealType = defaultDealType(property);
    setDealType(nextDealType);
    setSalePrice(defaultValue(property, nextDealType));
  }

  function updateDealType(nextDealType: DealType) {
    setDealType(nextDealType);
    setSalePrice(defaultValue(selectedProperty, nextDealType));
  }

  useEffect(() => {
    if (!open) return;
    if (!dealPropertyId) {
      const fallbackPropertyId = preselectedPropertyId ?? linkedProperties[0]?.id;
      if (fallbackPropertyId) selectDealProperty(fallbackPropertyId);
    }
    setNotes(initialNotes ?? "");
    // selectDealProperty derives state from linkedProperties.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedPropertyId, linkedProperties, dealPropertyId, initialNotes]);

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
          expected_close_date: expectedCloseDate || null,
          probability_override: probabilityOverride
            ? Number(probabilityOverride)
            : null,
          notes: notes || null,
          origin_viewing_id: originViewingId ?? null,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start deal");
      return;
    }
    setDealPropertyId("");
    setSalePrice("");
    setExpectedCloseDate("");
    setProbabilityOverride("");
    setNotes("");
    setError(null);
    await onComplete();
  }

  if (!open) return null;

  return (
    <ModalShell
      title="Start negotiating"
      subtitle={lead.name}
      onClose={onClose}
      onSubmit={submit}
      error={error}
      submitLabel="Start negotiating"
    >
      <RecordPicker
        label="Linked property"
        value={dealPropertyId}
        onChange={selectDealProperty}
        groups={propertyGroups}
        placeholder="Select linked property"
        searchPlaceholder="Search linked property"
        required
      />
      <DealTypePicker
        selectedProperty={selectedProperty}
        dealType={dealType}
        onChange={updateDealType}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={salePrice}
          onChange={(event) => setSalePrice(event.target.value)}
          type="number"
          min="0"
          placeholder="Opening offer / expected value"
          className="rounded-lg border px-3 py-2"
          required
        />
        <input
          value={expectedCloseDate}
          onChange={(event) => setExpectedCloseDate(event.target.value)}
          type="date"
          className="rounded-lg border px-3 py-2"
          aria-label="Expected close date"
        />
        <input
          value={probabilityOverride}
          onChange={(event) => setProbabilityOverride(event.target.value)}
          type="number"
          min="0"
          max="100"
          placeholder="Probability override %"
          className="rounded-lg border px-3 py-2"
        />
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Negotiation notes"
        className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
      />
    </ModalShell>
  );
}

export function WinDealModal({
  open,
  lead,
  propertyGroups,
  preselectedPropertyId,
  originViewingId,
  onClose,
  onComplete,
  getToken,
  dealId,
}: BaseDealModalProps & { dealId?: string | null }) {
  const linkedProperties = useMemo(() => activeProperties(lead), [lead]);
  const [dealPropertyId, setDealPropertyId] = useState("");
  const [dealType, setDealType] = useState<DealType>("Sale");
  const [salePrice, setSalePrice] = useState("");
  const [agencyFee, setAgencyFee] = useState("");
  const [lawyerFees, setLawyerFees] = useState("");
  const [commissionOverride, setCommissionOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedProperty = linkedProperties.find(
    (property) => property.id === dealPropertyId
  );

  function selectDealProperty(propertyId: string) {
    setDealPropertyId(propertyId);
    const property = linkedProperties.find((item) => item.id === propertyId);
    const nextDealType = defaultDealType(property);
    setDealType(nextDealType);
    setSalePrice(defaultValue(property, nextDealType));
  }

  function updateDealType(nextDealType: DealType) {
    setDealType(nextDealType);
    setSalePrice(defaultValue(selectedProperty, nextDealType));
  }

  useEffect(() => {
    if (!open || dealId || dealPropertyId) return;
    const fallbackPropertyId = preselectedPropertyId ?? linkedProperties[0]?.id;
    if (fallbackPropertyId) selectDealProperty(fallbackPropertyId);
    // selectDealProperty derives state from linkedProperties.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId, preselectedPropertyId, linkedProperties, dealPropertyId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getToken();
    try {
      let nextDealId = dealId;
      if (!nextDealId) {
        const created = await apiFetch<{ id: string }>("/deals", token, {
          method: "POST",
          body: JSON.stringify({
            lead_id: lead.id,
            property_id: dealPropertyId,
            deal_type: dealType,
            sale_price: Number(salePrice),
            origin_viewing_id: originViewingId ?? null,
          }),
        });
        nextDealId = created.id;
      }
      await apiFetch(`/deals/${nextDealId}/win`, token, {
        method: "POST",
        body: JSON.stringify({
          sale_price: Number(salePrice),
          deal_type: dealType,
          agency_fee: agencyFee ? Number(agencyFee) : null,
          lawyer_fees: lawyerFees ? Number(lawyerFees) : null,
          commission_override: commissionOverride
            ? Number(commissionOverride)
            : null,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to win deal");
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
    <ModalShell
      title="Close deal"
      subtitle={lead.name}
      onClose={onClose}
      onSubmit={submit}
      error={error}
      submitLabel="Close deal"
    >
      {!dealId ? (
        <>
          <RecordPicker
            label="Linked property"
            value={dealPropertyId}
            onChange={selectDealProperty}
            groups={propertyGroups}
            placeholder="Select linked property"
            searchPlaceholder="Search linked property"
            required
          />
          <DealTypePicker
            selectedProperty={selectedProperty}
            dealType={dealType}
            onChange={updateDealType}
          />
        </>
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
    </ModalShell>
  );
}

export function CloseDealModal(props: BaseDealModalProps) {
  return <WinDealModal {...props} />;
}

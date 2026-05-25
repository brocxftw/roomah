"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  TimelineEventList,
  type TimelineEvent,
} from "@/components/timeline-event-list";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type LeadDetail = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  budget_min?: number | null;
  budget_max?: number | null;
  preferred_location?: string | null;
  preferred_property_type?: string | null;
  linked_properties: unknown[];
  timeline: TimelineEvent[];
};

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { getToken } = useAuth();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [dealPropertyId, setDealPropertyId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [agencyFee, setAgencyFee] = useState("");
  const [lawyerFees, setLawyerFees] = useState("");
  const [commissionOverride, setCommissionOverride] = useState("");
  const [manualEventType, setManualEventType] = useState("manual_call");
  const [manualNote, setManualNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadLead() {
    const token = await getToken();
    const data = await apiFetch<LeadDetail>(`/leads/${leadId}`, token);
    setLead(data);
  }

  useEffect(() => {
    void loadLead().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load lead");
    });
    // loadLead depends on stable route/auth values and is intentionally kept local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, getToken]);

  const updateStatus = async (status: string) => {
    const token = await getToken();
    await apiFetch(`/leads/${leadId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadLead();
  };

  const linkProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    await apiFetch(`/leads/${leadId}/links`, token, {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId }),
    });
    setPropertyId("");
    await loadLead();
  };

  const logManualEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    await apiFetch(`/leads/${leadId}/timeline`, token, {
      method: "POST",
      body: JSON.stringify({
        event_type: manualEventType,
        note: manualNote,
      }),
    });
    setManualNote("");
    await loadLead();
  };

  const closeDeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    await apiFetch("/deals", token, {
      method: "POST",
      body: JSON.stringify({
        lead_id: leadId,
        property_id: dealPropertyId,
        sale_price: Number(salePrice),
        agency_fee: agencyFee ? Number(agencyFee) : null,
        lawyer_fees: lawyerFees ? Number(lawyerFees) : null,
        commission_override: commissionOverride
          ? Number(commissionOverride)
          : null,
      }),
    });
    setDealPropertyId("");
    setSalePrice("");
    setAgencyFee("");
    setLawyerFees("");
    setCommissionOverride("");
    await loadLead();
  };

  if (!lead) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading lead..."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{lead.name}</h2>
          <p className="text-muted-foreground">
            {lead.phone} · {lead.email}
          </p>
        </div>
        <select
          value={lead.status}
          onChange={(event) => void updateStatus(event.target.value)}
          className="rounded-md border px-3 py-2"
        >
          <option value="Active">Active</option>
          <option value="Negotiating">Negotiating</option>
          <option value="Closed">Closed</option>
          <option value="Lost">Lost</option>
        </select>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Preferences</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Budget</dt>
              <dd>
                {lead.budget_min ?? "-"} - {lead.budget_max ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd>{lead.preferred_location ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Property type</dt>
              <dd>{lead.preferred_property_type ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={linkProperty} className="rounded-lg border p-4">
          <h3 className="font-medium">Linked Properties</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.linked_properties.length} property link(s)
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              placeholder="Property UUID"
              className="w-full rounded-md border px-3 py-2"
              required
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Link
            </button>
          </div>
        </form>
      </section>

      <form onSubmit={logManualEvent} className="rounded-lg border p-4">
        <h3 className="font-medium">Log Interaction</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <select
            value={manualEventType}
            onChange={(event) => setManualEventType(event.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="manual_call">Called customer</option>
            <option value="manual_note">Negotiation note</option>
            <option value="manual_callback">Callback requested</option>
          </select>
          <input
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
            placeholder="Notes"
            className="rounded-md border px-3 py-2"
            required
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Save
          </button>
        </div>
      </form>

      <form onSubmit={closeDeal} className="rounded-lg border p-4">
        <h3 className="font-medium">Close Deal</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={dealPropertyId}
            onChange={(event) => setDealPropertyId(event.target.value)}
            placeholder="Linked property UUID"
            className="rounded-md border px-3 py-2"
            required
          />
          <input
            value={salePrice}
            onChange={(event) => setSalePrice(event.target.value)}
            type="number"
            min="0"
            placeholder="Final sale price"
            className="rounded-md border px-3 py-2"
            required
          />
          <input
            value={agencyFee}
            onChange={(event) => setAgencyFee(event.target.value)}
            type="number"
            min="0"
            placeholder="Agency fee override"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={lawyerFees}
            onChange={(event) => setLawyerFees(event.target.value)}
            type="number"
            min="0"
            placeholder="Lawyer fees override"
            className="rounded-md border px-3 py-2"
          />
          <input
            value={commissionOverride}
            onChange={(event) => setCommissionOverride(event.target.value)}
            type="number"
            min="0"
            placeholder="Commission override"
            className="rounded-md border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Close Deal
        </button>
      </form>

      <TimelineEventList events={lead.timeline} />
    </div>
  );
}

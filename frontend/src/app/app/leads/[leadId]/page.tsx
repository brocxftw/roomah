"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  TimelineEventList,
  type TimelineEvent,
} from "@/components/timeline-event-list";
import { CampaignPicker } from "@/components/campaign-picker";
import { RecordPicker, type RecordPickerGroup } from "@/components/record-picker";
import { apiFetch } from "@/lib/api";
import { propertyAddressSummary } from "@/lib/malaysia-areas";
import { useAuth } from "@/lib/use-auth";

type ListingType = "Sale" | "Rental" | "Both";

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
  campaign_id?: string | null;
  campaign?: {
    id: string;
    name: string;
    channel: string;
    status: string;
  } | null;
  linked_properties: LinkedProperty[];
  timeline: TimelineEvent[];
};

type LinkedProperty = {
  status: string;
  properties: {
    id: string;
    name: string;
    type?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    listing_type: ListingType;
    status?: string | null;
    listing_price?: number | null;
    expected_rental?: number | null;
  };
};

type PropertyOption = LinkedProperty["properties"] & {
  type: string;
  city: string;
  state: string;
  postcode: string;
  status: string;
};

type LinkPropertyResponse = {
  warnings?: string[];
};

function propertyDescription(property: LinkedProperty["properties"]) {
  return [property.type, propertyAddressSummary(property), property.status]
    .filter(Boolean)
    .join(" · ");
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { getToken } = useAuth();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [dealPropertyId, setDealPropertyId] = useState("");
  const [dealType, setDealType] = useState<"Sale" | "Rental">("Sale");
  const [salePrice, setSalePrice] = useState("");
  const [agencyFee, setAgencyFee] = useState("");
  const [lawyerFees, setLawyerFees] = useState("");
  const [commissionOverride, setCommissionOverride] = useState("");
  const [manualEventType, setManualEventType] = useState("manual_call");
  const [manualNote, setManualNote] = useState("");
  const [editingCampaign, setEditingCampaign] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [linkWarnings, setLinkWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadLead() {
    const token = await getToken();
    const data = await apiFetch<LeadDetail>(`/leads/${leadId}`, token);
    setLead(data);
  }

  async function loadProperties() {
    const token = await getToken();
    const data = await apiFetch<PropertyOption[]>("/properties", token);
    setProperties(
      data.filter((property) => ["Active", "Pending"].includes(property.status))
    );
  }

  useEffect(() => {
    void loadLead().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load lead");
    });
    void loadProperties().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load properties");
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

  const updateCampaign = async () => {
    const token = await getToken();
    await apiFetch(`/leads/${leadId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ campaign_id: selectedCampaignId }),
    });
    setEditingCampaign(false);
    await loadLead();
  };

  const linkProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    const response = await apiFetch<LinkPropertyResponse>(`/leads/${leadId}/links`, token, {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId }),
    });
    setLinkWarnings(response.warnings ?? []);
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
    try {
      await apiFetch("/deals", token, {
        method: "POST",
        body: JSON.stringify({
          lead_id: leadId,
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
    } catch (dealError) {
      setError(
        dealError instanceof Error
          ? dealError.message
          : "Failed to close deal"
      );
      return;
    }
    setDealPropertyId("");
    setSalePrice("");
    setDealType("Sale");
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

  const selectedDealProperty = lead.linked_properties.find(
    (link) =>
      link.status === "active" && link.properties.id === dealPropertyId
  )?.properties;
  const activeLinkedProperties = lead.linked_properties.filter(
    (link) => link.status === "active"
  );
  const activeLinkedPropertyIds = new Set(
    activeLinkedProperties.map((link) => link.properties.id)
  );
  const linkPropertyGroups: RecordPickerGroup[] = [
    {
      label: "Available properties",
      options: properties
        .filter((property) => !activeLinkedPropertyIds.has(property.id))
        .map((property) => ({
          value: property.id,
          label: property.name,
          description: propertyDescription(property),
          badge: property.listing_type,
        })),
    },
  ];
  const dealPropertyGroups: RecordPickerGroup[] = [
    {
      label: "Active linked properties",
      options: activeLinkedProperties.map((link) => ({
        value: link.properties.id,
        label: link.properties.name,
        description: propertyDescription(link.properties),
        badge: link.properties.listing_type,
      })),
    },
  ];

  const selectDealProperty = (propertyId: string) => {
    setDealPropertyId(propertyId);
    const property = lead.linked_properties.find(
      (link) => link.properties.id === propertyId
    )?.properties;
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
  };

  const updateDealType = (nextDealType: "Sale" | "Rental") => {
    setDealType(nextDealType);
    if (!selectedDealProperty) return;
    setSalePrice(
      String(
        nextDealType === "Rental"
          ? selectedDealProperty.expected_rental ?? ""
          : selectedDealProperty.listing_price ?? ""
      )
    );
  };

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

        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Campaign Attribution</h3>
          {editingCampaign ? (
            <div className="mt-3 space-y-3">
              <CampaignPicker
                value={selectedCampaignId}
                onChange={setSelectedCampaignId}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void updateCampaign()}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCampaign(false)}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {lead.campaign?.name ?? "Unattributed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lead.campaign
                    ? `${lead.campaign.channel} · ${lead.campaign.status}`
                    : "No campaign selected"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCampaignId(lead.campaign_id ?? null);
                  setEditingCampaign(true);
                }}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <form onSubmit={linkProperty} className="rounded-lg border p-4">
          <h3 className="font-medium">Linked Properties</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.linked_properties.length} property link(s)
          </p>
          <div className="mt-3 space-y-2">
            {lead.linked_properties.map((link) => (
              <div
                key={link.properties.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{link.properties.name}</span>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">
                  {link.properties.listing_type}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <RecordPicker
                label="Property to link"
              value={propertyId}
                onChange={setPropertyId}
                groups={linkPropertyGroups}
                placeholder="Select property"
                searchPlaceholder="Search property name, type, location, or status"
              required
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Link
            </button>
          </div>
          {linkWarnings.length ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {linkWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
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
          <RecordPicker
            label="Linked property"
            value={dealPropertyId}
            onChange={selectDealProperty}
            groups={dealPropertyGroups}
            placeholder="Select linked property"
            searchPlaceholder="Search linked property"
            required
          />
          {selectedDealProperty?.listing_type === "Both" ? (
            <div className="flex items-center gap-4 rounded-md border px-3 py-2">
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

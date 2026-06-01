"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { RecordPicker, type RecordPickerGroup } from "@/components/record-picker";
import { apiFetch } from "@/lib/api";
import { propertyAddressSummary } from "@/lib/malaysia-areas";
import { useAuth } from "@/lib/use-auth";

type ListingType = "Sale" | "Rental" | "Both";

type UserOption = {
  id: string;
  email: string;
  full_name: string;
};

type LeadOption = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
};

type PropertyOption = {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  listing_type: ListingType;
  status: string;
};

type LeadDetail = LeadOption & {
  linked_properties: {
    status: string;
    properties: PropertyOption;
  }[];
};

type ViewingDetail = {
  id: string;
  lead_id: string;
  property_id: string;
  assigned_ren_id: string;
  scheduled_at: string;
};

function leadDescription(lead: LeadOption) {
  return `${lead.phone} · ${lead.email} · ${lead.status}`;
}

function propertyDescription(property: PropertyOption) {
  return [property.type, propertyAddressSummary(property), property.status]
    .filter(Boolean)
    .join(" · ");
}

function datetimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function queryDateTime(searchParams: URLSearchParams) {
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  if (!date) return "";
  return `${date}T${time || "10:00"}`;
}

export default function NewViewingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const editViewingId = searchParams.get("edit");
  const preselectedPropertyId = searchParams.get("property") ?? "";
  const preselectedLeadId = searchParams.get("lead") ?? "";
  const preselectedRenId = searchParams.get("assigned_ren") ?? "";
  const preselectedScheduledAt = queryDateTime(searchParams);
  const [form, setForm] = useState({
    lead_id: preselectedLeadId,
    property_id: preselectedPropertyId,
    scheduled_at: preselectedScheduledAt,
    assigned_ren_id: preselectedRenId,
  });
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [editingViewing, setEditingViewing] = useState<ViewingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    async function loadOptions() {
      const token = await getToken();
      const [leadOptions, propertyOptions] = await Promise.all([
        apiFetch<LeadOption[]>("/leads", token),
        apiFetch<PropertyOption[]>("/properties", token),
      ]);

      setLeads(leadOptions);
      setProperties(
        propertyOptions.filter((property) =>
          ["Active", "Pending"].includes(property.status)
        )
      );

      try {
        const teamUsers = await apiFetch<UserOption[]>("/users", token);
        setUsers(teamUsers);
      } catch {
        const currentUser = await apiFetch<UserOption>("/users/me", token);
        setUsers([currentUser]);
        setForm((current) => ({
          ...current,
          assigned_ren_id: current.assigned_ren_id || currentUser.id,
        }));
      }
    }

    void loadOptions().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load options");
    });
  }, [getToken]);

  useEffect(() => {
    async function loadSelectedLead() {
      if (!form.lead_id) {
        setSelectedLead(null);
        return;
      }

      const token = await getToken();
      const lead = await apiFetch<LeadDetail>(`/leads/${form.lead_id}`, token);
      setSelectedLead(lead);
    }

    void loadSelectedLead().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load lead");
    });
  }, [form.lead_id, getToken]);

  useEffect(() => {
    async function loadEditingViewing() {
      if (!editViewingId) return;
      const token = await getToken();
      const viewing = await apiFetch<ViewingDetail>(
        `/viewings/${editViewingId}`,
        token
      );
      setEditingViewing(viewing);
      setForm({
        lead_id: viewing.lead_id,
        property_id: viewing.property_id,
        scheduled_at: datetimeLocalValue(viewing.scheduled_at),
        assigned_ren_id: viewing.assigned_ren_id,
      });
    }

    void loadEditingViewing().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load viewing");
    });
  }, [editViewingId, getToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getToken();
    try {
      if (editViewingId) {
        await apiFetch(`/viewings/${editViewingId}/reschedule`, token, {
          method: "PATCH",
          body: JSON.stringify({
            scheduled_at: new Date(form.scheduled_at).toISOString(),
          }),
        });
        if (
          editingViewing &&
          form.assigned_ren_id !== editingViewing.assigned_ren_id
        ) {
          await apiFetch(`/viewings/${editViewingId}/reassign`, token, {
            method: "PATCH",
            body: JSON.stringify({ assigned_ren_id: form.assigned_ren_id }),
          });
        }
        router.push(`/app/viewings?viewing=${editViewingId}`);
      } else {
        await apiFetch("/viewings", token, {
          method: "POST",
          body: JSON.stringify({
            ...form,
            scheduled_at: new Date(form.scheduled_at).toISOString(),
          }),
        });
        router.push("/app/viewings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save viewing");
    }
  };

  const leadGroups: RecordPickerGroup[] = [
    {
      options: leads.map((lead) => ({
        value: lead.id,
        label: lead.name,
        description: leadDescription(lead),
      })),
    },
  ];

  const linkedProperties =
    selectedLead?.linked_properties
      .filter((link) => link.status === "active")
      .map((link) => link.properties)
      .filter((property) => ["Active", "Pending"].includes(property.status)) ?? [];
  const linkedPropertyIds = new Set(
    linkedProperties.map((property) => property.id)
  );
  const propertyGroups: RecordPickerGroup[] = [];
  if (linkedProperties.length) {
    propertyGroups.push({
      label: "Linked to selected lead",
      options: linkedProperties.map((property) => ({
        value: property.id,
        label: property.name,
        description: propertyDescription(property),
        badge: property.listing_type,
      })),
    });
  }
  propertyGroups.push({
    label: "All available properties",
    options: properties
      .filter((property) => !linkedPropertyIds.has(property.id))
      .map((property) => ({
        value: property.id,
        label: property.name,
        description: propertyDescription(property),
        badge: property.listing_type,
      })),
  });

  const userGroups: RecordPickerGroup[] = [
    {
      options: users.map((user) => ({
        value: user.id,
        label: user.full_name,
        description: user.email,
      })),
    },
  ];

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {editViewingId ? "Edit Viewing" : "Schedule Viewing"}
        </h2>
        <p className="text-muted-foreground">
          {editViewingId
            ? "Update the appointment time or assigned REN."
            : "Choose lead, property, date/time, and assigned REN."}
        </p>
      </div>

      <RecordPicker
        label="Lead"
        value={form.lead_id}
        onChange={(value) => {
          updateField("lead_id", value);
          updateField("property_id", "");
        }}
        groups={leadGroups}
        placeholder="Select lead"
        searchPlaceholder="Search lead name, phone, email, or status"
        required
      />
      <RecordPicker
        label="Property"
        value={form.property_id}
        onChange={(value) => updateField("property_id", value)}
        groups={propertyGroups}
        placeholder="Select property"
        searchPlaceholder="Search property name, type, location, or status"
        required
      />
      <input
        aria-label="Scheduled date and time"
        value={form.scheduled_at}
        onChange={(event) => updateField("scheduled_at", event.target.value)}
        type="datetime-local"
        className="w-full rounded-md border px-3 py-2"
        required
      />
      <RecordPicker
        label="Assigned REN"
        value={form.assigned_ren_id}
        onChange={(value) => updateField("assigned_ren_id", value)}
        groups={userGroups}
        placeholder="Select assigned REN"
        searchPlaceholder="Search REN name or email"
        required
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {editViewingId ? "Save Changes" : "Save Viewing"}
      </button>
    </form>
  );
}

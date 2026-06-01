"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  RecordPicker,
  type RecordPickerGroup,
} from "@/components/record-picker";
import { apiFetch } from "@/lib/api";
import {
  placeholdersInBody,
  renderTemplateBody,
  templateDefaultBody,
  TEMPLATE_PLACEHOLDERS,
  type TemplatePropertyContext,
} from "@/lib/campaign-content-templates";
import { propertyAddressSummary } from "@/lib/malaysia-areas";
import { useAuth } from "@/lib/use-auth";

const CAMPAIGN_CHANNELS = [
  "Facebook",
  "WhatsApp",
  "TikTok",
  "Threads",
  "Instagram",
  "Mudah.my",
  "Others",
];
const OTHERS_CHANNEL = "Others";

const TEMPLATE_FORMATS = ["Caption", "WhatsApp", "Email", "Ad Copy", "SMS"];
const TEMPLATE_CHANNELS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Threads",
  "Google",
  "WhatsApp",
  "Email",
  "SMS",
  "Other",
];

// Best-effort default mapping from the campaign's channel to a template format
// so the preview lands on something useful before the user picks a template.
function defaultTemplateFormatForChannel(channel: string) {
  if (channel === "WhatsApp") return "WhatsApp";
  if (channel === "Facebook") return "Ad Copy";
  if (channel === "Instagram" || channel === "TikTok" || channel === "Threads") {
    return "Caption";
  }
  return "Caption";
}

type CampaignFormRecord = {
  id: string;
  name: string;
  channel: string;
  channel_other_label?: string | null;
  campaign_start_date: string;
  campaign_end_date?: string | null;
  budget?: string | number | null;
  ad_spending?: string | number | null;
  impressions?: number | null;
  clicks?: number | null;
  external_url?: string | null;
};

type ListingType = "Sale" | "Rental" | "Both";

type PropertyOption = {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  listing_type: ListingType;
  status: string;
  listing_price?: string | number | null;
  expected_rental?: string | number | null;
};

type CampaignContentTemplate = {
  id: string;
  name: string;
  channel: string;
  format: string;
  body: string;
  placeholders: string[];
  is_starter: boolean;
  created_by?: string | null;
};

type TemplateFormState = {
  id: string | null;
  name: string;
  channel: string;
  format: string;
  body: string;
};

const emptyTemplateForm: TemplateFormState = {
  id: null,
  name: "",
  channel: "Instagram",
  format: "Caption",
  body: templateDefaultBody("Caption"),
};

function propertyDescription(property: PropertyOption) {
  return [property.type, propertyAddressSummary(property), property.status]
    .filter(Boolean)
    .join(" · ");
}

function propertyToTemplateContext(
  property: PropertyOption | null
): TemplatePropertyContext | null {
  if (!property) return null;
  return {
    name: property.name,
    type: property.type,
    city: property.city,
    state: property.state,
    listing_type: property.listing_type,
    listing_price: property.listing_price,
    expected_rental: property.expected_rental,
  };
}

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const editId = searchParams.get("edit");
  const duplicateId = searchParams.get("duplicate");
  const preselectedPropertyId = searchParams.get("property") ?? "";
  const sourceId = editId ?? duplicateId;
  const isEditMode = Boolean(editId);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState(CAMPAIGN_CHANNELS[0]);
  const [channelOtherLabel, setChannelOtherLabel] = useState("");
  const [propertyId, setPropertyId] = useState(preselectedPropertyId);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [templates, setTemplates] = useState<CampaignContentTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesMessage, setTemplatesMessage] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateFormat, setTemplateFormat] = useState(() =>
    defaultTemplateFormatForChannel(CAMPAIGN_CHANNELS[0])
  );
  const [templateChannel, setTemplateChannel] = useState("");
  const [templateSource, setTemplateSource] = useState("");
  const [templateForm, setTemplateForm] =
    useState<TemplateFormState>(emptyTemplateForm);
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);

  useEffect(() => {
    if (!sourceId) return;

    async function loadSourceCampaign() {
      setLoadingSource(true);
      setError(null);
      try {
        const token = await getToken();
        const campaign = await apiFetch<CampaignFormRecord>(
          `/campaigns/${sourceId}`,
          token
        );
        setName(duplicateId ? `${campaign.name} Copy` : campaign.name);
        setChannel(campaign.channel);
        setChannelOtherLabel(campaign.channel_other_label ?? "");
        setStartDate(campaign.campaign_start_date);
        setEndDate(campaign.campaign_end_date ?? "");
        setBudget(campaign.budget ? String(campaign.budget) : "");
        setExternalUrl(campaign.external_url ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaign");
      } finally {
        setLoadingSource(false);
      }
    }

    void loadSourceCampaign();
  }, [duplicateId, editId, getToken, sourceId]);

  useEffect(() => {
    async function loadProperties() {
      const token = await getToken();
      const data = await apiFetch<PropertyOption[]>("/properties", token);
      setProperties(data);
    }

    void loadProperties().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load properties");
    });
  }, [getToken]);

  useEffect(() => {
    async function loadCurrentUser() {
      const token = await getToken();
      const me = await apiFetch<{ role?: string }>("/users/me", token);
      setCurrentUserRole(me?.role ?? null);
    }
    void loadCurrentUser().catch(() => {
      // Non-fatal; falls back to hiding manager-only affordances.
    });
  }, [getToken]);

  useEffect(() => {
    async function loadTemplates() {
      const token = await getToken();
      const data = await apiFetch<CampaignContentTemplate[]>(
        "/campaign-content-templates",
        token
      );
      setTemplates(data);
    }

    void loadTemplates().catch((err) => {
      setTemplatesError(
        err instanceof Error ? err.message : "Failed to load templates"
      );
    });
  }, [getToken]);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId) ?? null,
    [properties, propertyId]
  );
  const propertyContext = useMemo(
    () => propertyToTemplateContext(selectedProperty),
    [selectedProperty]
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (templateQuery) {
        const needle = templateQuery.toLowerCase();
        if (
          !`${template.name} ${template.channel} ${template.format} ${template.body}`
            .toLowerCase()
            .includes(needle)
        ) {
          return false;
        }
      }
      if (templateFormat && template.format !== templateFormat) return false;
      if (templateChannel && template.channel !== templateChannel) return false;
      if (templateSource === "starter" && !template.is_starter) return false;
      if (templateSource === "private" && template.is_starter) return false;
      return true;
    });
  }, [templates, templateQuery, templateFormat, templateChannel, templateSource]);
  const starterTemplates = filteredTemplates.filter((t) => t.is_starter);
  const privateTemplates = filteredTemplates.filter((t) => !t.is_starter);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );
  const composed = selectedTemplate
    ? renderTemplateBody(selectedTemplate.body, propertyContext)
    : null;

  async function copyContent() {
    if (!composed) return;
    await navigator.clipboard.writeText(composed.rendered);
    setTemplatesMessage("Generated content copied.");
  }

  function resetTemplateFilters() {
    setTemplateQuery("");
    setTemplateFormat("");
    setTemplateChannel("");
    setTemplateSource("");
  }

  function editTemplate(template: CampaignContentTemplate) {
    setManageTemplatesOpen(true);
    setTemplateForm({
      id: template.id,
      name: template.name,
      channel: template.channel,
      format: template.format,
      body: template.body,
    });
  }

  function updateTemplateFormat(nextFormat: string) {
    setTemplateForm((current) => ({
      ...current,
      format: nextFormat,
      body:
        current.body && current.body !== templateDefaultBody(current.format)
          ? current.body
          : templateDefaultBody(nextFormat),
    }));
  }

  async function saveTemplate() {
    if (!templateForm.name || !templateForm.body) return;
    const token = await getToken();
    const payload = {
      name: templateForm.name,
      channel: templateForm.channel,
      format: templateForm.format,
      body: templateForm.body,
      placeholders: placeholdersInBody(templateForm.body),
    };
    try {
      const saved = await apiFetch<CampaignContentTemplate>(
        templateForm.id
          ? `/campaign-content-templates/${templateForm.id}`
          : "/campaign-content-templates",
        token,
        {
          method: templateForm.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setTemplates((current) =>
        templateForm.id
          ? current.map((template) =>
              template.id === saved.id ? saved : template
            )
          : [...current, saved]
      );
      setTemplateForm(emptyTemplateForm);
      setTemplatesMessage(
        templateForm.id ? "Template updated." : "Template created."
      );
      setTemplatesError(null);
    } catch (err) {
      setTemplatesError(
        err instanceof Error ? err.message : "Failed to save template"
      );
    }
  }

  async function deleteTemplate(template: CampaignContentTemplate) {
    const message = template.is_starter
      ? `Delete the starter template "${template.name}"? Starter templates are shared across all teams; this will remove it for everyone.`
      : `Delete ${template.name}?`;
    const confirmed = window.confirm(message);
    if (!confirmed) return;
    const token = await getToken();
    try {
      await apiFetch(`/campaign-content-templates/${template.id}`, token, {
        method: "DELETE",
      });
      setTemplates((current) =>
        current.filter((existing) => existing.id !== template.id)
      );
      if (selectedTemplateId === template.id) setSelectedTemplateId(null);
      setTemplatesMessage("Template deleted.");
      setTemplatesError(null);
    } catch (err) {
      setTemplatesError(
        err instanceof Error ? err.message : "Failed to delete template"
      );
    }
  }

  const canManageStarterTemplates = currentUserRole === "MANAGER";

  // ``saveAs`` controls the create-time status: "active" (default) is what
  // pressing the primary Save button does so a freshly-created campaign is
  // immediately visible to the team, while "draft" mirrors the legacy
  // behaviour from the secondary Save as draft button. Edit mode ignores it.
  async function submit(saveAs: "active" | "draft" = "active") {
    if (channel === OTHERS_CHANNEL && !channelOtherLabel.trim()) {
      setError("Please specify a channel name when selecting Others.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const payload: Record<string, unknown> = {
        name,
        channel,
        channel_other_label:
          channel === OTHERS_CHANNEL ? channelOtherLabel.trim() : null,
        campaign_start_date: startDate,
        campaign_end_date: endDate || null,
        budget: budget ? Number(budget) : null,
        external_url: externalUrl || null,
      };
      if (!editId) {
        payload.status = saveAs === "active" ? "Active" : "Draft";
      }
      const saved = await apiFetch<CampaignFormRecord>(
        editId ? `/campaigns/${editId}` : "/campaigns",
        token,
        {
          method: editId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      router.push(`/app/campaigns?campaign=${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (editId) {
      router.push(`/app/campaigns?campaign=${editId}`);
      return;
    }
    if (duplicateId) {
      router.push(`/app/campaigns?campaign=${duplicateId}`);
      return;
    }
    router.push("/app/campaigns");
  }

  const title = isEditMode
    ? "Edit Campaign"
    : duplicateId
      ? "Duplicate Campaign"
      : "Campaign Details";
  const description = isEditMode
    ? "Update campaign setup and external campaign link."
    : duplicateId
      ? "Create a draft copy. Generated metrics start from zero unless you enter new values."
      : "Create a draft campaign that can be attributed to new and existing leads.";

  const propertyGroups: RecordPickerGroup[] = [
    {
      label: "Active and pending listings",
      options: properties
        .filter((property) => ["Active", "Pending"].includes(property.status))
        .map((property) => ({
          value: property.id,
          label: property.name,
          description: propertyDescription(property),
          badge: property.listing_type,
        })),
    },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit("active");
      }}
      className="space-y-6"
    >
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>

        {loadingSource ? (
          <p className="mt-4 text-sm text-slate-500">Loading campaign...</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Campaign name
            </span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Channel
            </span>
            <select
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value);
                if (event.target.value !== OTHERS_CHANNEL) {
                  setChannelOtherLabel("");
                }
              }}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            >
              {CAMPAIGN_CHANNELS.map((campaignChannel) => (
                <option key={campaignChannel} value={campaignChannel}>
                  {campaignChannel === OTHERS_CHANNEL
                    ? "Others (specify)"
                    : campaignChannel}
                </option>
              ))}
            </select>
            {channel === OTHERS_CHANNEL ? (
              <input
                required
                value={channelOtherLabel}
                onChange={(event) => setChannelOtherLabel(event.target.value)}
                placeholder="Specify channel name (e.g. LinkedIn, In-store)"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
              />
            ) : null}
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Start date
            </span>
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              End date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <div className="md:col-span-2">
            <RecordPicker
              label="Promote a property (optional)"
              value={propertyId}
              onChange={setPropertyId}
              groups={propertyGroups}
              placeholder="Select a property to auto-fill template content"
              searchPlaceholder="Search property name, type, location, or status"
            />
            <p className="mt-1 text-xs text-slate-500">
              Selecting a property powers the live preview below — placeholders
              like <code>{"{{property_name}}"}</code> get filled with that
              listing&apos;s data. The property is not stored on the campaign
              record.
            </p>
          </div>

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Campaign URL
            </span>
            <input
              type="text"
              inputMode="url"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="facebook.com/roomah/post/123"
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="block text-xs text-slate-500">
              Optional. Paste the external campaign link — we&apos;ll add{" "}
              <code>https://</code> if it&apos;s missing.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Campaign Content
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pick a template, preview it with the selected property, then copy
              and paste into the external platform.
            </p>
          </div>
          {!selectedProperty ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Select a property above to fill placeholders automatically.
            </p>
          ) : null}
        </div>

        {templatesMessage ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {templatesMessage}
          </p>
        ) : null}
        {templatesError ? (
          <p className="mt-4 text-sm text-red-600">{templatesError}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={templateQuery}
            onChange={(event) => setTemplateQuery(event.target.value)}
            placeholder="Search template name or content"
            className="min-h-11 min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={templateFormat}
            onChange={(event) => setTemplateFormat(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All formats</option>
            {TEMPLATE_FORMATS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={templateChannel}
            onChange={(event) => setTemplateChannel(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All channels</option>
            {TEMPLATE_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={templateSource}
            onChange={(event) => setTemplateSource(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Starter and private</option>
            <option value="starter">Starter only</option>
            <option value="private">My templates only</option>
          </select>
          <button
            type="button"
            onClick={resetTemplateFilters}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Reset
          </button>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <TemplateSection
              title="Starter Templates"
              templates={starterTemplates}
              selectedTemplateId={selectedTemplateId}
              onUse={setSelectedTemplateId}
              onDelete={
                canManageStarterTemplates
                  ? (template) => void deleteTemplate(template)
                  : undefined
              }
            />
            <TemplateSection
              title="My Templates"
              templates={privateTemplates}
              selectedTemplateId={selectedTemplateId}
              onUse={setSelectedTemplateId}
              onEdit={editTemplate}
              onDelete={(template) => void deleteTemplate(template)}
            />
            {!filteredTemplates.length ? (
              <div className="rounded-xl border bg-slate-50 p-6 text-center">
                <FileText
                  className="mx-auto h-7 w-7 text-slate-400"
                  aria-hidden
                />
                <p className="mt-3 text-sm font-medium text-slate-900">
                  No matching templates.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Clear filters or create your own reusable copy below.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="rounded-xl border bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-slate-500" aria-hidden />
              <h3 className="font-semibold text-slate-900">Compose Copy</h3>
            </div>
            {selectedTemplate && composed ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-slate-900">
                  {selectedTemplate.name}
                </p>
                <textarea
                  value={composed.rendered}
                  readOnly
                  className="min-h-56 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
                {composed.unresolved.length ? (
                  <p className="text-xs text-amber-700">
                    Missing values: {composed.unresolved.join(", ")}. These
                    placeholders remain in the copy for review.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void copyContent()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy content
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Choose a template to generate copy. With a property selected
                above, placeholders fill in automatically.
              </p>
            )}
          </aside>
        </div>

        <div className="mt-6 border-t pt-4">
          <button
            type="button"
            onClick={() => setManageTemplatesOpen((open) => !open)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
          >
            {manageTemplatesOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
            {templateForm.id
              ? "Editing template"
              : manageTemplatesOpen
                ? "Hide template editor"
                : "Manage my templates"}
          </button>

          {manageTemplatesOpen ? (
            <div className="mt-4 rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-slate-500" aria-hidden />
                <h3 className="font-semibold text-slate-900">
                  {templateForm.id ? "Edit Template" : "New Template"}
                </h3>
              </div>
              <div className="mt-4 space-y-3">
                <input
                  value={templateForm.name}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Template name"
                  className="min-h-11 w-full rounded-lg border px-3 text-sm"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={templateForm.format}
                    onChange={(event) => updateTemplateFormat(event.target.value)}
                    className="min-h-11 rounded-lg border px-3 text-sm"
                  >
                    {TEMPLATE_FORMATS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    value={templateForm.channel}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        channel: event.target.value,
                      }))
                    }
                    className="min-h-11 rounded-lg border px-3 text-sm"
                  >
                    {TEMPLATE_CHANNELS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={templateForm.body}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  className="min-h-48 w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      onClick={() =>
                        setTemplateForm((current) => ({
                          ...current,
                          body: `${current.body}${current.body.endsWith(" ") ? "" : " "}{{${placeholder}}}`,
                        }))
                      }
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {`{{${placeholder}}}`}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveTemplate()}
                    disabled={!templateForm.name || !templateForm.body}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {templateForm.id ? "Save template" : "Create template"}
                  </button>
                  {templateForm.id ? (
                    <button
                      type="button"
                      onClick={() => setTemplateForm(emptyTemplateForm)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">Budget</h2>
        <p className="mt-1 text-sm text-slate-500">
          {duplicateId
            ? "Budget resets for draft copies so past performance is not carried over."
            : "Optional planned budget. Spending, impressions, and clicks are tracked inline on the campaigns table as the campaign runs."}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Budget (RM)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={cancel}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        {!isEditMode ? (
          <button
            type="button"
            onClick={() => void submit("draft")}
            disabled={saving || loadingSource || !name}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {saving ? "Saving..." : "Save as draft"}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving || loadingSource || !name}
          className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving
            ? "Saving..."
            : isEditMode
              ? "Save Campaign"
              : duplicateId
                ? "Launch Campaign Copy"
                : "Launch Campaign"}
        </button>
      </div>
    </form>
  );
}

function TemplateSection({
  title,
  templates,
  selectedTemplateId,
  onUse,
  onEdit,
  onDelete,
}: {
  title: string;
  templates: CampaignContentTemplate[];
  selectedTemplateId: string | null;
  onUse: (templateId: string) => void;
  onEdit?: (template: CampaignContentTemplate) => void;
  onDelete?: (template: CampaignContentTemplate) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        {!templates.length && title === "My Templates" ? (
          <p className="text-sm text-slate-500">
            No private templates yet. Use Manage my templates below to create
            one.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <article
            key={template.id}
            className={[
              "rounded-xl border bg-white p-4 shadow-sm",
              selectedTemplateId === template.id
                ? "ring-2 ring-slate-900"
                : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-slate-900">
                  {template.name}
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{template.format}</Badge>
                  <Badge>{template.channel}</Badge>
                  {template.is_starter ? (
                    <Badge>Starter</Badge>
                  ) : (
                    <Badge>Private</Badge>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-sm text-slate-600">
              {template.body}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUse(template.id)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                Use
              </button>
              {!template.is_starter && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(template)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(template)}
                  title={
                    template.is_starter
                      ? "Delete this starter template (visible to all teams)"
                      : undefined
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

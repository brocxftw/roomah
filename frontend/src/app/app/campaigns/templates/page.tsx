"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  Copy,
  FileText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import {
  placeholdersInBody,
  renderTemplateBody,
  templateDefaultBody,
  TEMPLATE_PLACEHOLDERS,
  type TemplatePropertyContext,
} from "@/lib/campaign-content-templates";
import { useAuth } from "@/lib/use-auth";

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

type PropertyContext = TemplatePropertyContext & {
  id: string;
};

type TemplateFormState = {
  id: string | null;
  name: string;
  channel: string;
  format: string;
  body: string;
};

const emptyForm: TemplateFormState = {
  id: null,
  name: "",
  channel: "Instagram",
  format: "Caption",
  body: templateDefaultBody("Caption"),
};

export default function CampaignTemplatesPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("property");
  const [templates, setTemplates] = useState<CampaignContentTemplate[]>([]);
  const [property, setProperty] = useState<PropertyContext | null>(null);
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("");
  const [channel, setChannel] = useState("");
  const [source, setSource] = useState("");
  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;
  const composed = selectedTemplate
    ? renderTemplateBody(selectedTemplate.body, property)
    : null;
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (query) {
        const needle = query.toLowerCase();
        if (
          !`${template.name} ${template.channel} ${template.format} ${template.body}`
            .toLowerCase()
            .includes(needle)
        ) {
          return false;
        }
      }
      if (format && template.format !== format) return false;
      if (channel && template.channel !== channel) return false;
      if (source === "starter" && !template.is_starter) return false;
      if (source === "private" && template.is_starter) return false;
      return true;
    });
  }, [templates, query, format, channel, source]);
  const starterTemplates = filteredTemplates.filter((template) => template.is_starter);
  const privateTemplates = filteredTemplates.filter((template) => !template.is_starter);

  useEffect(() => {
    async function loadTemplates() {
      const token = await getToken();
      const data = await apiFetch<CampaignContentTemplate[]>(
        "/campaign-content-templates",
        token
      );
      setTemplates(data);
      setError(null);
    }

    void loadTemplates().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    });
  }, [getToken]);

  useEffect(() => {
    if (!propertyId) {
      setProperty(null);
      return;
    }
    async function loadProperty() {
      const token = await getToken();
      const data = await apiFetch<PropertyContext>(`/properties/${propertyId}`, token);
      setProperty(data);
    }

    void loadProperty().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load property context");
    });
  }, [getToken, propertyId]);

  function updateFormat(nextFormat: string) {
    setForm((current) => ({
      ...current,
      format: nextFormat,
      body:
        current.body && current.body !== templateDefaultBody(current.format)
          ? current.body
          : templateDefaultBody(nextFormat),
    }));
  }

  function editTemplate(template: CampaignContentTemplate) {
    setForm({
      id: template.id,
      name: template.name,
      channel: template.channel,
      format: template.format,
      body: template.body,
    });
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getToken();
    const payload = {
      name: form.name,
      channel: form.channel,
      format: form.format,
      body: form.body,
      placeholders: placeholdersInBody(form.body),
    };
    try {
      const saved = await apiFetch<CampaignContentTemplate>(
        form.id ? `/campaign-content-templates/${form.id}` : "/campaign-content-templates",
        token,
        {
          method: form.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setTemplates((current) =>
        form.id
          ? current.map((template) => (template.id === saved.id ? saved : template))
          : [...current, saved]
      );
      setForm(emptyForm);
      setMessage(form.id ? "Template updated." : "Template created.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    }
  }

  async function deleteTemplate(template: CampaignContentTemplate) {
    const confirmed = window.confirm(`Delete ${template.name}?`);
    if (!confirmed) return;
    const token = await getToken();
    try {
      await apiFetch(`/campaign-content-templates/${template.id}`, token, {
        method: "DELETE",
      });
      setTemplates((current) =>
        current.filter((currentTemplate) => currentTemplate.id !== template.id)
      );
      if (selectedTemplateId === template.id) setSelectedTemplateId(null);
      setMessage("Template deleted.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  }

  async function copyContent() {
    if (!composed) return;
    await navigator.clipboard.writeText(composed.rendered);
    setMessage("Generated content copied.");
  }

  function resetFilters() {
    setQuery("");
    setFormat("");
    setChannel("");
    setSource("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Campaign Templates
          </h2>
          <p className="text-sm text-slate-500">
            Create reusable copy, fill property placeholders, and paste the content into external platforms.
          </p>
        </div>
        <Link
          href="/app/campaigns"
          className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Back to campaigns
        </Link>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {property ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-950">
            Composing with property context: {property.name}
          </p>
          <p className="mt-1 text-sm text-blue-800">
            Supported placeholders will be filled from this property. Missing values remain visible before copying.
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search template name or content"
            className="min-h-11 min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
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
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
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
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Starter and private</option>
            <option value="starter">Starter only</option>
            <option value="private">My templates only</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <TemplateSection
            title="Starter Templates"
            templates={starterTemplates}
            selectedTemplateId={selectedTemplateId}
            onUse={setSelectedTemplateId}
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
            <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
              <FileText className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
              <p className="mt-3 text-sm font-medium text-slate-900">
                No matching templates.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Clear filters or create your own reusable campaign copy.
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <form onSubmit={saveTemplate} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-slate-500" aria-hidden />
              <h3 className="font-semibold text-slate-900">
                {form.id ? "Edit Template" : "New Template"}
              </h3>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Template name"
                required
                className="min-h-11 w-full rounded-lg border px-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={form.format}
                  onChange={(event) => updateFormat(event.target.value)}
                  className="min-h-11 rounded-lg border px-3 text-sm"
                >
                  {TEMPLATE_FORMATS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={form.channel}
                  onChange={(event) =>
                    setForm((current) => ({
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
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({ ...current, body: event.target.value }))
                }
                required
                className="min-h-48 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
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
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  {form.id ? "Save template" : "Create template"}
                </button>
                {form.id ? (
                  <button
                    type="button"
                    onClick={() => setForm(emptyForm)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
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
                  className="min-h-56 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"
                />
                {composed.unresolved.length ? (
                  <p className="text-xs text-amber-700">
                    Missing values: {composed.unresolved.join(", ")}. These placeholders remain in the copy for review.
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
                Choose a template to generate copy. If you came from a property, placeholders will be filled automatically.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
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
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {!templates.length && title === "My Templates" ? (
          <p className="text-sm text-slate-500">
            No private templates yet. Create one from the form on the right.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <article
            key={template.id}
            className={[
              "rounded-xl border bg-white p-4 shadow-sm",
              selectedTemplateId === template.id ? "ring-2 ring-slate-900" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-slate-900">{template.name}</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{template.format}</Badge>
                  <Badge>{template.channel}</Badge>
                  {template.is_starter ? <Badge>Starter</Badge> : <Badge>Private</Badge>}
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
              {!template.is_starter && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(template)}
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

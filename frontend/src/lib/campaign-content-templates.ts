export type TemplatePropertyContext = {
  name?: string | null;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  listing_type?: string | null;
  listing_price?: string | number | null;
  expected_rental?: string | number | null;
};

export const TEMPLATE_PLACEHOLDERS = [
  "property_name",
  "price",
  "location",
  "listing_type",
  "property_type",
] as const;

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export function templateDefaultBody(format: string) {
  if (format === "WhatsApp") {
    return "Hi, I wanted to share {{property_name}} in {{location}}. It is available for {{listing_type}} at {{price}}. Would you like more details?";
  }
  if (format === "Email") {
    return "Subject: Property recommendation - {{property_name}}\n\nHi,\n\nI wanted to share {{property_name}}, a {{property_type}} in {{location}} available for {{listing_type}} at {{price}}.\n\nLet me know if you would like more details.";
  }
  if (format === "Ad Copy") {
    return "Discover {{property_name}}, a {{property_type}} in {{location}} available for {{listing_type}} from {{price}}. Contact us today.";
  }
  if (format === "SMS") {
    return "{{property_name}} in {{location}} for {{listing_type}} at {{price}}. Reply for details.";
  }
  return "New listing: {{property_name}} in {{location}}. {{listing_type}} opportunity from {{price}}. Message me for viewing details.";
}

export function placeholdersInBody(body: string) {
  return Array.from(body.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map(
    (match) => match[1]
  );
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function propertyPlaceholderValues(property?: TemplatePropertyContext | null) {
  if (!property) return {};
  const price =
    property.listing_type === "Rental"
      ? property.expected_rental
      : property.listing_price ?? property.expected_rental;
  return {
    property_name: property.name ?? null,
    property_type: property.type ?? null,
    location: [property.city, property.state].filter(Boolean).join(", ") || null,
    listing_type: property.listing_type ?? null,
    price: formatCurrency(price),
  };
}

export function renderTemplateBody(
  body: string,
  property?: TemplatePropertyContext | null
) {
  const values = propertyPlaceholderValues(property);
  const unresolved = new Set<string>();
  const rendered = body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    const value = values[key as TemplatePlaceholder];
    if (!value) {
      unresolved.add(key);
      return match;
    }
    return value;
  });
  return { rendered, unresolved: Array.from(unresolved) };
}

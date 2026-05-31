export const PROPERTY_TYPES = [
  "Apartment",
  "Condominium",
  "Bungalow",
  "Terrace House",
  "Semi-Detached",
  "Townhouse",
  "Studio",
  "Penthouse",
  "Villa",
  "Shophouse",
  "Commercial Office",
  "Land",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

const PROPERTY_TYPE_SLUGS: Record<PropertyType, string> = {
  Apartment: "apartment",
  Condominium: "condominium",
  Bungalow: "bungalow",
  "Terrace House": "terrace-house",
  "Semi-Detached": "semi-detached",
  Townhouse: "townhouse",
  Studio: "studio",
  Penthouse: "penthouse",
  Villa: "villa",
  Shophouse: "shophouse",
  "Commercial Office": "commercial-office",
  Land: "land",
};

const NORMALIZED_PROPERTY_TYPES = new Map<string, PropertyType>([
  ...PROPERTY_TYPES.map(
    (propertyType) => [normalizePropertyType(propertyType), propertyType] as const
  ),
  ["condo", "Condominium"],
  ["condominium unit", "Condominium"],
  ["flat", "Apartment"],
  ["apartment unit", "Apartment"],
  ["terrace", "Terrace House"],
  ["terraced house", "Terrace House"],
  ["terrace home", "Terrace House"],
  ["semi detached", "Semi-Detached"],
  ["semi detached house", "Semi-Detached"],
  ["semi d", "Semi-Detached"],
  ["semi-d", "Semi-Detached"],
  ["office", "Commercial Office"],
  ["commercial", "Commercial Office"],
  ["office space", "Commercial Office"],
  ["shop house", "Shophouse"],
  ["retail shophouse", "Shophouse"],
  ["lot", "Land"],
  ["land plot", "Land"],
]);

export function normalizePropertyType(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalPropertyType(value: string | null | undefined) {
  if (!value) return null;
  return NORMALIZED_PROPERTY_TYPES.get(normalizePropertyType(value)) ?? null;
}

export function propertyTypeSlug(value: string) {
  const canonicalType = canonicalPropertyType(value);
  if (!canonicalType) {
    return normalizePropertyType(value).replace(/\s+/g, "-") || "default";
  }
  return PROPERTY_TYPE_SLUGS[canonicalType];
}

export function propertyTypeLabel(value: string | null | undefined) {
  return canonicalPropertyType(value) ?? value?.trim() ?? "";
}

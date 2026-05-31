import { canonicalPropertyType, propertyTypeSlug } from "./property-types";

const STOCK_IMAGE_BASE_PATH = "/property-stock";
const DEFAULT_STOCK_IMAGE = `${STOCK_IMAGE_BASE_PATH}/default.jpg`;

export type PropertyImageSource = {
  type?: string | null;
  cover_image_url?: string | null;
};

export function stockImageForType(type: string | null | undefined) {
  if (!type) return DEFAULT_STOCK_IMAGE;

  const canonicalType = canonicalPropertyType(type);
  if (!canonicalType) return DEFAULT_STOCK_IMAGE;

  return `${STOCK_IMAGE_BASE_PATH}/${propertyTypeSlug(canonicalType)}.jpg`;
}

export function resolvePropertyImage(property: PropertyImageSource) {
  return property.cover_image_url || stockImageForType(property.type);
}

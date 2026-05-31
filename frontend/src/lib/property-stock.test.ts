import { describe, expect, it } from "vitest";

import { PROPERTY_TYPES, propertyTypeSlug } from "./property-types";
import { resolvePropertyImage, stockImageForType } from "./property-stock";

describe("property stock image resolution", () => {
  it("maps every canonical property type to a bundled stock image", () => {
    for (const propertyType of PROPERTY_TYPES) {
      expect(stockImageForType(propertyType)).toBe(
        `/property-stock/${propertyTypeSlug(propertyType)}.jpg`
      );
    }
  });

  it("normalizes legacy free-text variants before resolving the image", () => {
    expect(stockImageForType("terraced house")).toBe(
      "/property-stock/terrace-house.jpg"
    );
    expect(stockImageForType("semi detached house")).toBe(
      "/property-stock/semi-detached.jpg"
    );
    expect(stockImageForType("office")).toBe(
      "/property-stock/commercial-office.jpg"
    );
  });

  it("falls back to the generic default image for unknown types", () => {
    expect(stockImageForType("farm warehouse")).toBe(
      "/property-stock/default.jpg"
    );
  });

  it("prefers an uploaded cover image over stock defaults", () => {
    expect(
      resolvePropertyImage({
        type: "Condominium",
        cover_image_url: "https://example.com/cover.jpg",
      })
    ).toBe("https://example.com/cover.jpg");
  });

  it("uses stock fallback when no uploaded cover image exists", () => {
    expect(
      resolvePropertyImage({
        type: "Villa",
        cover_image_url: null,
      })
    ).toBe("/property-stock/villa.jpg");
  });
});

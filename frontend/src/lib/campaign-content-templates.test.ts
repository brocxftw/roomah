import { describe, expect, it } from "vitest";

import {
  placeholdersInBody,
  renderTemplateBody,
  templateDefaultBody,
} from "./campaign-content-templates";

describe("campaign content template utilities", () => {
  it("renders supported property placeholders", () => {
    const result = renderTemplateBody(
      "{{property_name}} in {{location}} is a {{property_type}} for {{listing_type}} at {{price}}.",
      {
        name: "Kiara Residence",
        type: "Condominium",
        city: "Mont Kiara",
        state: "Kuala Lumpur",
        listing_type: "Sale",
        listing_price: 880000,
      }
    );

    expect(result.rendered).toBe(
      "Kiara Residence in Mont Kiara, Kuala Lumpur is a Condominium for Sale at RM 880,000."
    );
    expect(result.unresolved).toEqual([]);
  });

  it("preserves unresolved placeholders for user review", () => {
    const result = renderTemplateBody("Promote {{property_name}} at {{price}}.", {
      name: "Unknown Price Listing",
      city: "Ipoh",
      state: "Perak",
    });

    expect(result.rendered).toBe("Promote Unknown Price Listing at {{price}}.");
    expect(result.unresolved).toEqual(["price"]);
  });

  it("detects placeholders and provides format defaults", () => {
    expect(placeholdersInBody("Hi {{property_name}} at {{location}}")).toEqual([
      "property_name",
      "location",
    ]);
    expect(templateDefaultBody("WhatsApp")).toContain("{{property_name}}");
  });
});

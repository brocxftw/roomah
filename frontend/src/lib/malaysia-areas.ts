export const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
] as const;

const AREA_ALIASES: Record<string, string> = {
  "mont kiara": "Mont Kiara",
  bangsar: "Bangsar",
  "bukit bintang": "Bukit Bintang",
  cheras: "Cheras",
  damansara: "Damansara",
  "desa parkcity": "Desa ParkCity",
  klcc: "KLCC",
  "petaling jaya": "Petaling Jaya",
  pj: "Petaling Jaya",
  puchong: "Puchong",
  setapak: "Setapak",
  "shah alam": "Shah Alam",
  "subang jaya": "Subang Jaya",
  "taman desa": "Taman Desa",
  ttdi: "TTDI",
};

export function suggestCityFromAddress(...parts: string[]) {
  const haystack = parts.join(" ").toLowerCase();
  const match = Object.entries(AREA_ALIASES).find(([alias]) =>
    haystack.includes(alias)
  );

  return match?.[1] ?? "";
}

export function propertyAddressSummary(property: {
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
}) {
  return [property.city, property.state, property.postcode]
    .filter(Boolean)
    .join(", ");
}

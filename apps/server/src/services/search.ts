/**
 * Natural-language hostel search: "Hostel in East Legon with WiFi under 3000"
 * extracts budget, school, amenities — the rest becomes tolerant keywords.
 */
export interface ParsedSearch {
  text: string[];
  maxPrice?: number;
  school?: string;
  amenities: string[];
  noAgentFee?: boolean;
  verifiedOnly?: boolean;
  momoOnly?: boolean;
  closeToCampus?: boolean;
}

const SCHOOLS = ["Legon", "KNUST", "UCC", "UPSA", "UDS"];

// keyword (lowercase) -> canonical stored amenity value
const AMENITY_KEYWORDS: Record<string, string> = {
  wifi: "WiFi",
  water: "Water 24/7",
  single: "Single room",
  self: "Self-contained",
  selfcontained: "Self-contained",
  campus: "Close to campus",
  light: "Light",
  ac: "AC",
  security: "24/7 Security",
  kitchen: "Kitchen",
  laundry: "Laundry Area",
  study: "Study Room",
  parking: "Parking Space",
  dstv: "DSTV",
  tv: "DSTV",
  generator: "Backup Generator",
  backup: "Backup Generator",
  balcony: "Balcony",
  wardrobe: "Wardrobe",
  heater: "Water Heater",
  cctv: "CCTV",
  cleaning: "Cleaning Service",
  cleaner: "Cleaning Service",
  prepaid: "Prepaid Meter",
  meter: "Prepaid Meter",
};

const STOPWORDS = new Set(
  "hostel hostels room rooms flat flats apartment apartments in near with and for a an the me my get wey dey try find finds looking look want need needs please abeg make show give to no agent fee only verified momo installment installments close campus under below max up less than per semester sem mo month air conditioning".split(" ")
);

export function parseSearchQuery(raw: string | undefined): ParsedSearch {
  const out: ParsedSearch = { text: [], amenities: [] };
  if (!raw || !raw.trim()) return out;
  let q = ` ${raw.toLowerCase()} `;

  // Budget: "under 3000", "below GH₵2500", "max 3k", "up to 5000"
  const budget = q.match(/(?:under|below|max|up to|less than)\s*(?:gh[₵s]?)?\s*([\d,]+(?:\.\d+)?)\s*(k)?/);
  if (budget) {
    let n = Number(budget[1].replace(/,/g, ""));
    if (budget[2]) n *= 1000;
    if (Number.isFinite(n) && n > 0) out.maxPrice = Math.round(n);
    q = q.replace(budget[0], " ");
  }

  // School: word match
  for (const s of SCHOOLS) {
    if (new RegExp(`\\b${s.toLowerCase()}\\b`).test(q)) {
      out.school = s;
      q = q.replace(new RegExp(`\\b${s.toLowerCase()}\\b`, "g"), " ");
      break;
    }
  }

  // Filter phrases (before amenity keywords: "close to campus" contains "campus")
  if (/no agent fee/.test(q)) {
    out.noAgentFee = true;
    q = q.replace(/no agent fee/g, " ");
  }
  if (/\bverified\b/.test(q)) {
    out.verifiedOnly = true;
    q = q.replace(/\bverified\b/g, " ");
  }
  if (/\bmomo\b|\binstallments?\b/.test(q)) {
    out.momoOnly = true;
    q = q.replace(/\bmomo\b/g, " ").replace(/\binstallments?\b/g, " ");
  }
  if (/close to campus/.test(q)) {
    out.closeToCampus = true;
    q = q.replace(/close to campus/g, " ");
  }

  // Amenities (word-boundary matched so "ac" never fires inside "accra")
  if (/air conditioning/.test(q)) {
    if (!out.amenities.includes("AC")) out.amenities.push("AC");
    q = q.replace(/air conditioning/g, " ");
  }
  for (const [kw, canonical] of Object.entries(AMENITY_KEYWORDS)) {
    const re = new RegExp(`\\b${kw}\\b`, "g");
    if (re.test(q) && !out.amenities.includes(canonical)) {
      out.amenities.push(canonical);
      q = q.replace(re, " ");
    }
  }

  // Remainder → significant keywords
  out.text = q
    .replace(/[^a-z0-9₵\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  return out;
}

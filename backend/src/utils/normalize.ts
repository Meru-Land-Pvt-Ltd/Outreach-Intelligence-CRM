// Shared normalization helpers. Keep worker/src/utils/normalize.ts identical.

export function normalizeDomainValue(value: any): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .replace(/\/$/, "")
    .trim();
}

export function normalizeBrandNameValue(value: any): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function escapeRegexValue(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Case-insensitive exact matcher for legacy rows saved before normalized
// fields existed.
export function legacyExactInsensitive(value: string): RegExp {
  return new RegExp("^" + escapeRegexValue(value) + "$", "i");
}

// Query that matches an ExcludedBrand document by normalized fields first and
// falls back to case-insensitive matching on legacy brandName/domain fields.
export function buildExcludedBrandMatch(brandName: any, domain: any) {
  const normalizedBrandName = normalizeBrandNameValue(brandName);
  const normalizedDomain = normalizeDomainValue(domain);

  const conditions: any[] = [];

  if (normalizedBrandName) {
    conditions.push({ normalizedBrandName });
    conditions.push({ brandName: legacyExactInsensitive(normalizedBrandName) });
  }

  if (normalizedDomain) {
    conditions.push({ normalizedDomain });
    conditions.push({ domain: legacyExactInsensitive(normalizedDomain) });
  }

  return conditions.length > 0 ? { $or: conditions } : null;
}

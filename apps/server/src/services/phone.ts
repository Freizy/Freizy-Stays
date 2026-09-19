/**
 * Normalize Ghana phone numbers to MoMo MSISDN format (233XXXXXXXXX).
 * Accepts +233…, 233…, 0XXXXXXXXX. Returns null when invalid.
 */
export function normalizeGhanaMsisdn(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = input.replace(/\D/g, "");
  if (/^233\d{9}$/.test(d)) return d;
  if (/^0\d{9}$/.test(d)) return `233${d.slice(1)}`;
  return null;
}

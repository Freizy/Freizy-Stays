import { env } from "../config/env";
import crypto from "crypto";

const API = "https://api.paystack.co";

export function isPaystackConfigured(): boolean {
  return !!env.paystackSecret;
}

/** Verify a Paystack webhook HMAC-SHA512 signature against the raw request body. */
export function verifyPaystackSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!env.paystackSecret || !signature || !rawBody) return false;
  const hash = crypto.createHmac("sha512", env.paystackSecret).update(rawBody).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ps(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.paystackSecret}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: Record<string, unknown> };
  if (!res.ok || !body.status || !body.data) throw new Error(`Paystack ${path}: ${body.message ?? res.status}`);
  return body.data;
}

export async function initializeTransaction(args: {
  email: string;
  amountGHS: number;
  reference: string;
  channels: string[];
}): Promise<{ authorization_url: string; access_code: string }> {
  const data = await ps("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amountGHS * 100),
      reference: args.reference,
      currency: "GHS",
      ...(env.paystackCallbackUrl ? { callback_url: env.paystackCallbackUrl } : {}),
      channels: args.channels,
      metadata: { source: "freizy-stays" },
    }),
  });
  return { authorization_url: String(data.authorization_url), access_code: String(data.access_code) };
}

export async function verifyTransaction(reference: string): Promise<"success" | "failed" | "pending"> {
  const data = await ps(`/transaction/verify/${encodeURIComponent(reference)}`);
  const s = String(data.status ?? "").toLowerCase();
  if (s === "success") return "success";
  if (s === "failed" || s === "abandoned") return "failed";
  return "pending";
}

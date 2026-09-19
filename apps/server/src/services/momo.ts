import { env } from "../config/env";

const base = () =>
  env.momo.environment === "production"
    ? "https://proxy.momodeveloper.mtn.com"
    : "https://sandbox.momodeveloper.mtn.com";

export function isMomoConfigured(): boolean {
  return !!(env.momo.apiKey && env.momo.userId && env.momo.subscriptionKey && env.momo.callbackUrl);
}

let cached: { token: string; exp: number } | null = null;

async function momoFetch(path: string, init: RequestInit & { token?: string } = {}): Promise<unknown> {
  const { token, ...rest } = init;
  const headers: Record<string, string> = {
    "Ocp-Apim-Subscription-Key": env.momo.subscriptionKey,
    ...((rest.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base()}${path}`, { ...rest, headers, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`MoMo ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as unknown) : null;
}

export async function getMomoToken(): Promise<string> {
  if (cached && Date.now() < cached.exp) return cached.token;
  const basic = Buffer.from(`${env.momo.userId}:${env.momo.apiKey}`).toString("base64");
  const res = await fetch(`${base()}/collection/token/`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": env.momo.subscriptionKey, Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`MoMo token failed: ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, exp: Date.now() + Math.max(body.expires_in - 60, 30) * 1000 };
  return cached.token;
}

export async function requestToPay(args: { amountGHS: number; msisdn: string; reference: string; note: string }): Promise<void> {
  const token = await getMomoToken();
  const note = args.note.slice(0, 160);
  await momoFetch("/collection/v1_0/requesttopay", {
    method: "POST",
    token,
    headers: {
      "X-Reference-Id": args.reference,
      "X-Target-Environment": env.momo.environment,
      "X-Callback-Url": env.momo.callbackUrl,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(args.amountGHS),
      currency: "GHS",
      externalId: args.reference,
      payer: { partyIdType: "MSISDN", partyId: args.msisdn },
      payerMessage: note,
      payeeNote: note,
    }),
  });
}

export type MomoTxStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "UNKNOWN";

export async function getTransactionStatus(reference: string): Promise<MomoTxStatus> {
  const token = await getMomoToken();
  const body = (await momoFetch(`/collection/v1_0/requesttopay/${reference}`, {
    token,
    headers: { "X-Target-Environment": env.momo.environment },
  })) as { status?: string };
  const s = (body.status ?? "").toUpperCase();
  return s === "SUCCESSFUL" || s === "FAILED" || s === "PENDING" ? (s as MomoTxStatus) : "UNKNOWN";
}

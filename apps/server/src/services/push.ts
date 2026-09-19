import { prisma } from "../config/prisma";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Send to one user by id. Never throws — logs and drops on failure. */
export async function notifyUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
    if (!user?.pushToken) return;
    await sendPush([{ to: user.pushToken, title, body, data }]);
  } catch (e) {
    console.warn("[push]", e instanceof Error ? e.message : e);
  }
}

export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (!messages.length) return;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      to: m.to,
      title: m.title,
      body: m.body,
      data: m.data ?? {},
      sound: "default" as const,
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) console.warn("[push] expo rejected", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.warn("[push]", e instanceof Error ? e.message : e);
    }
  }
}

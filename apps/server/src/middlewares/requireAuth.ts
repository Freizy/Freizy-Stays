import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { prisma } from "../config/prisma";

export interface AuthedRequest extends Request {
  userId?: string;
  role?: "STUDENT" | "OWNER" | "ADMIN";
  supabaseUserId?: string;
}

/** Verifies Supabase JWT, then loads local User row (creates stub if first login). */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing bearer token" });
    const token = header.slice(7);
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      console.warn("[auth] getUser failed:", error?.message ?? "no user returned");
      return res.status(401).json({ message: "Invalid token", detail: error?.message ?? "no user returned" });
    }

    const supabaseId = data.user.id;
    // Supabase returns "" (not null) for missing contact fields — normalize so
    // unique constraints don't collide across users without phones/emails.
    const phone = data.user.phone?.trim() ? data.user.phone : null;
    const email = data.user.email?.trim() ? data.user.email : null;

    let user;
    try {
      // Only overwrite contact fields the provider actually supplies —
      // never blank a manually set number/email with null.
      const contact = { ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
      user = await prisma.user.upsert({
        where: { supabaseId },
        update: contact,
        create: { supabaseId, phone, email },
      });
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
        return res.status(409).json({ message: "An account with these details already exists" });
      }
      throw e;
    }
    if (user.suspended) return res.status(403).json({ message: "Account suspended. Contact Freizy support." });
    req.userId = user.id;
    req.role = user.role;
    req.supabaseUserId = supabaseId;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Array<"STUDENT" | "OWNER" | "ADMIN">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

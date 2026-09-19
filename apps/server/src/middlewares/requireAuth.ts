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
    if (error || !data.user) return res.status(401).json({ message: "Invalid token" });

    const supabaseId = data.user.id;
    const phone = (data.user.phone as string | undefined) ?? null;
    const email = data.user.email ?? null;

    let user = await prisma.user.findUnique({ where: { supabaseId } });
    if (!user) {
      user = await prisma.user.create({ data: { supabaseId, phone, email } });
    }
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

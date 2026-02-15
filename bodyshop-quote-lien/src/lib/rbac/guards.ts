import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getRequestSession } from "@/lib/auth/session";

export async function requireRoles(request: NextRequest, roles: Role[]) {
  const session = await getRequestSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}

export function canSeeAnalytics(role: Role) {
  return role === "OWNER" || role === "OFFICE";
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyMagicLinkSchema } from "@/lib/validators/magic-link";
import { createSessionCookie, hashToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  const parsed = verifyMagicLinkSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const tokenHash = hashToken(parsed.data.token);
  const token = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return NextResponse.json({ error: "Magic link invalid or expired" }, { status: 401 });
  }

  await prisma.magicLinkToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });

  await createSessionCookie({
    userId: token.user.id,
    role: token.user.role,
    email: token.user.email
  });

  return NextResponse.json({ ok: true });
}

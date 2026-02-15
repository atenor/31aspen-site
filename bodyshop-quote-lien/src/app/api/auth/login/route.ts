import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators/auth";
import { prisma } from "@/lib/db";
import { comparePassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const valid = await comparePassword(parsed.data.password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  await createSessionCookie({ userId: user.id, role: user.role, email: user.email });
  return NextResponse.json({ ok: true });
}

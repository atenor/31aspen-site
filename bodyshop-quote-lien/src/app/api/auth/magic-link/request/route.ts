import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestMagicLinkSchema } from "@/lib/validators/magic-link";
import { hashToken } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/sender";

export async function POST(request: Request) {
  const parsed = requestMagicLinkSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    // Do not leak user existence
    return NextResponse.json({ ok: true });
  }

  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.magicLinkToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/magic-link?token=${rawToken}`;

  await sendEmail({
    to: user.email,
    subject: "Your BodyShop Quote & Lien sign-in link",
    text: `Use this secure sign-in link (valid 15 minutes): ${verifyUrl}`
  });

  if (!process.env.SMTP_HOST) {
    console.log("[MAGIC LINK DEV]", verifyUrl);
  }

  return NextResponse.json({ ok: true });
}

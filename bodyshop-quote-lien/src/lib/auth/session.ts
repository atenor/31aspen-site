import crypto from "crypto";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "bql_session";

export type SessionPayload = {
  userId: string;
  role: Role;
  email: string;
};

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, requireSecret(), { expiresIn: "14d" });
}

export function verifySession(token: string) {
  return jwt.verify(token, requireSecret()) as SessionPayload;
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = signSession(payload);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: payload.userId,
      tokenHash,
      expiresAt
    }
  });

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySessionCookie() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  cookies().delete(COOKIE_NAME);
}

export async function getServerSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verifySession(token);
    const tokenHash = hashToken(token);
    const active = await prisma.session.findUnique({ where: { tokenHash } });
    if (!active || active.expiresAt < new Date()) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function getRequestSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verifySession(token);
    const tokenHash = hashToken(token);
    const active = await prisma.session.findUnique({ where: { tokenHash } });
    if (!active || active.expiresAt < new Date()) return null;

    return payload;
  } catch {
    return null;
  }
}

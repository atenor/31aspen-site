import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { hashPassword } from "@/lib/auth/password";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role)
});

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, [Role.OWNER]);
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, [Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid user payload" }, { status: 400 });

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });

  return NextResponse.json({ user }, { status: 201 });
}

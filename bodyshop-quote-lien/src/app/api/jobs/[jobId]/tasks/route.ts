import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { taskSchema } from "@/lib/validators/task";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      jobId: params.jobId,
      type: parsed.data.type,
      dueAt: new Date(parsed.data.dueAt),
      assignedToUserId: parsed.data.assignedToUserId,
      note: parsed.data.note
    }
  });

  return NextResponse.json({ task }, { status: 201 });
}

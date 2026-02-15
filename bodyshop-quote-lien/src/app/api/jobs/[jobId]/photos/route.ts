import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { saveBase64Image } from "@/lib/storage/files";

const schema = z.object({
  base64: z.string().min(8),
  caption: z.string().optional(),
  tagPanel: z.string().optional()
});

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid photo payload" }, { status: 400 });

  const url = await saveBase64Image(`jobs/${params.jobId}/photos/${Date.now()}.png`, parsed.data.base64);

  const photo = await prisma.photo.create({
    data: {
      jobId: params.jobId,
      url,
      caption: parsed.data.caption,
      tagPanel: parsed.data.tagPanel
    }
  });

  return NextResponse.json({ photo }, { status: 201 });
}

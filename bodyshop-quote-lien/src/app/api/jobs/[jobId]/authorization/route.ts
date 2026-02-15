import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { authorizationSchema } from "@/lib/validators/authorization";
import { saveBase64Image, saveFileBuffer } from "@/lib/storage/files";
import { generateAuthorizationPdf } from "@/lib/pdf/templates";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = authorizationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid authorization payload" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: params.jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const signedAt = new Date();
  const imageUrl = await saveBase64Image(
    `jobs/${params.jobId}/signatures/${Date.now()}.png`,
    parsed.data.signatureBase64
  );

  const pdfBuffer = await generateAuthorizationPdf({
    jobNumber: job.jobNumber,
    signerName: parsed.data.signerName,
    signedAt: signedAt.toISOString(),
    signerIp: request.headers.get("x-forwarded-for") || "unknown"
  });

  const pdfUrl = await saveFileBuffer(`jobs/${params.jobId}/docs/auth-${Date.now()}.pdf`, Buffer.from(pdfBuffer));

  const authorization = await prisma.authorization.create({
    data: {
      jobId: params.jobId,
      type: parsed.data.type,
      signerName: parsed.data.signerName,
      signerEmail: parsed.data.signerEmail || null,
      signatureImageUrl: imageUrl,
      signatureTyped: parsed.data.signatureTyped,
      signedAt,
      signerIp: request.headers.get("x-forwarded-for") || "unknown",
      signerUserAgent: request.headers.get("user-agent") || "unknown",
      pdfUrl
    }
  });

  await prisma.document.create({
    data: {
      jobId: params.jobId,
      type: "AUTH_SIGNED",
      url: pdfUrl
    }
  });

  return NextResponse.json({ authorization }, { status: 201 });
}

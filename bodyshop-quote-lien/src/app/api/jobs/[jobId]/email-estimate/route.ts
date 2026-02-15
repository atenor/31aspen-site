import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { generateEstimatePdf } from "@/lib/pdf/templates";
import { saveFileBuffer } from "@/lib/storage/files";
import { sendEmail } from "@/lib/email/sender";
import { centsToDollars } from "@/lib/utils";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: { customer: true, vehicle: true, estimate: true }
  });

  if (!job || !job.estimate) return NextResponse.json({ error: "Job or estimate missing" }, { status: 404 });

  const pdf = await generateEstimatePdf({
    jobNumber: job.jobNumber,
    customerName: job.customer.name,
    vehicle: `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`,
    totalWritten: `$${centsToDollars(job.estimate.totalWrittenCents)}`,
    notes: job.notesCustomer || undefined
  });

  const pdfUrl = await saveFileBuffer(`jobs/${job.id}/docs/estimate-${Date.now()}.pdf`, Buffer.from(pdf));

  await prisma.document.create({
    data: {
      jobId: job.id,
      type: "ESTIMATE_PDF",
      url: pdfUrl
    }
  });

  await sendEmail({
    to: job.customer.email,
    subject: `Estimate ${job.jobNumber}`,
    text: "Attached is your estimate from the shop.",
    attachments: [{ filename: `estimate-${job.jobNumber}.pdf`, content: Buffer.from(pdf) }]
  });

  return NextResponse.json({ ok: true, pdfUrl });
}

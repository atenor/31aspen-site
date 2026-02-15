import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { generateInsurancePacketPdf } from "@/lib/pdf/templates";
import { saveFileBuffer } from "@/lib/storage/files";
import { sendEmail } from "@/lib/email/sender";
import { centsToDollars } from "@/lib/utils";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      customer: true,
      estimate: true,
      claim: true
    }
  });

  if (!job || !job.estimate || !job.claim) return NextResponse.json({ error: "Insurance packet requires claim + estimate" }, { status: 404 });
  if (!job.claim.adjusterEmail) return NextResponse.json({ error: "Adjuster email missing" }, { status: 400 });

  const pdf = await generateInsurancePacketPdf({
    jobNumber: job.jobNumber,
    carrier: job.claim.carrierName,
    claimNumber: job.claim.claimNumber,
    customerName: job.customer.name,
    estimateTotal: `$${centsToDollars(job.estimate.totalWrittenCents)}`
  });

  const pdfUrl = await saveFileBuffer(`jobs/${job.id}/docs/insurance-packet-${Date.now()}.pdf`, Buffer.from(pdf));

  await prisma.document.create({
    data: {
      jobId: job.id,
      type: "INSURANCE_PACKET",
      url: pdfUrl
    }
  });

  await prisma.claim.update({
    where: { jobId: job.id },
    data: {
      dateSent: new Date(),
      lastFollowUpAt: new Date()
    }
  });

  await sendEmail({
    to: job.claim.adjusterEmail,
    subject: `Insurance packet ${job.jobNumber} / Claim ${job.claim.claimNumber}`,
    text: "Attached is the insurance packet and itemized estimate.",
    attachments: [{ filename: `insurance-${job.jobNumber}.pdf`, content: Buffer.from(pdf) }]
  });

  await prisma.auditLog.create({
    data: {
      jobId: job.id,
      actorUserId: auth.session.userId,
      action: "SEND_INSURANCE_PACKET",
      afterJson: { pdfUrl }
    }
  });

  return NextResponse.json({ ok: true, pdfUrl });
}

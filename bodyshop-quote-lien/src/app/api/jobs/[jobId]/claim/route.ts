import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { claimSchema } from "@/lib/validators/claim";
import { refreshStorageAndLien } from "@/lib/workflows/lien";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = claimSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid claim payload" }, { status: 400 });

  const estimate = await prisma.estimate.findUnique({ where: { jobId: params.jobId } });

  const approvedAmountCents = parsed.data.approvedAmountCents ?? null;
  const shortPayCents = approvedAmountCents !== null ? (estimate?.totalWrittenCents ?? 0) - approvedAmountCents : null;

  const claim = await prisma.claim.upsert({
    where: { jobId: params.jobId },
    update: {
      carrierName: parsed.data.carrierName,
      claimNumber: parsed.data.claimNumber,
      adjusterName: parsed.data.adjusterName,
      adjusterEmail: parsed.data.adjusterEmail || null,
      adjusterPhone: parsed.data.adjusterPhone,
      approvedAmountCents,
      shortPayCents,
      dateSent: parsed.data.dateSent ? new Date(parsed.data.dateSent) : undefined,
      nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : undefined,
      lastFollowUpAt: new Date()
    },
    create: {
      jobId: params.jobId,
      carrierName: parsed.data.carrierName,
      claimNumber: parsed.data.claimNumber,
      adjusterName: parsed.data.adjusterName,
      adjusterEmail: parsed.data.adjusterEmail || null,
      adjusterPhone: parsed.data.adjusterPhone,
      approvedAmountCents,
      shortPayCents,
      dateSent: parsed.data.dateSent ? new Date(parsed.data.dateSent) : null,
      nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null,
      lastFollowUpAt: new Date()
    }
  });

  if (parsed.data.nextFollowUpAt) {
    await prisma.task.create({
      data: {
        jobId: params.jobId,
        type: "FOLLOW_UP_ADJUSTER",
        dueAt: new Date(parsed.data.nextFollowUpAt),
        assignedToUserId: auth.session.userId,
        note: "Auto-created from claim follow-up date"
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      jobId: params.jobId,
      actorUserId: auth.session.userId,
      action: "UPDATE_CLAIM",
      afterJson: { approvedAmountCents, shortPayCents }
    }
  });

  await refreshStorageAndLien(params.jobId);

  return NextResponse.json({ claim });
}

import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { statusUpdateSchema } from "@/lib/validators/job";
import { computeBalance, sumByPayer } from "@/lib/calc/receivables";
import { canDeliverVehicle } from "@/lib/calc/release";
import { refreshStorageAndLien } from "@/lib/workflows/lien";

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      customer: true,
      vehicle: true,
      claim: true,
      estimate: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
      photos: true,
      payments: { orderBy: { receivedAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueAt: "asc" } },
      lienCase: true,
      authorizations: { orderBy: { signedAt: "desc" } }
    }
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totals = sumByPayer(job.payments.map((payment) => ({ payerType: payment.payerType, amountCents: payment.amountCents })));
  const balanceCents = computeBalance(job.estimate?.totalWrittenCents ?? 0, totals.total);

  return NextResponse.json({ job, balanceCents, paidBreakdown: totals });
}

export async function PATCH(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = statusUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid status payload" }, { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      estimate: true,
      payments: true
    }
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings) return NextResponse.json({ error: "Missing settings" }, { status: 500 });

  const paid = sumByPayer(job.payments.map((entry) => ({ payerType: entry.payerType, amountCents: entry.amountCents }))).total;
  const balanceCents = computeBalance(job.estimate?.totalWrittenCents ?? 0, paid);

  if (parsed.data.status === "DELIVERED") {
    const release = canDeliverVehicle({
      role: auth.session.role,
      balanceCents,
      releaseControlEnabled: settings.releaseControlEnabled,
      overrideReason: parsed.data.overrideReason
    });

    if (!release.allowed) {
      return NextResponse.json(
        { error: "Vehicle release blocked. Outstanding balance requires OWNER override." },
        { status: 409 }
      );
    }

    if (release.overrideLogged) {
      await prisma.auditLog.create({
        data: {
          jobId: job.id,
          actorUserId: auth.session.userId,
          action: "OVERRIDE_RELEASE",
          beforeJson: { balanceCents },
          afterJson: { overrideReason: parsed.data.overrideReason }
        }
      });
    }
  }

  const updated = await prisma.job.update({
    where: { id: params.jobId },
    data: {
      status: parsed.data.status,
      deliveredDate: parsed.data.status === "DELIVERED" ? new Date() : job.deliveredDate,
      completedDate: parsed.data.status === "COMPLETE" ? new Date() : job.completedDate,
      storageStartDate: parsed.data.storageStartDate ? new Date(parsed.data.storageStartDate) : job.storageStartDate
    }
  });

  await prisma.auditLog.create({
    data: {
      jobId: job.id,
      actorUserId: auth.session.userId,
      action: "UPDATE_STATUS",
      beforeJson: { status: job.status },
      afterJson: { status: updated.status }
    }
  });

  await refreshStorageAndLien(params.jobId);

  return NextResponse.json({ job: updated });
}

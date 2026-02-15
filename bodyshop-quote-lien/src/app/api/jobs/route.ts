import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { createJobSchema } from "@/lib/validators/job";
import { makeJobNumber } from "@/lib/utils";
import { computeBalance, determineAgingAnchor, computeAgingBucket, sumByPayer } from "@/lib/calc/receivables";
import { isUnpaidJob } from "@/lib/job-metrics";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const filter = request.nextUrl.searchParams.get("filter") || "all";

  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      vehicle: true,
      claim: true,
      estimate: true,
      payments: true,
      lienCase: true
    }
  });

  const mapped = jobs.map((job) => {
    const totals = sumByPayer(job.payments.map((payment) => ({ payerType: payment.payerType, amountCents: payment.amountCents })));
    const balanceCents = computeBalance(job.estimate?.totalWrittenCents ?? 0, totals.total);
    const anchor = determineAgingAnchor(job.completedDate, job.claim?.dateSent);

    return {
      ...job,
      balanceCents,
      agingBucket: computeAgingBucket(anchor),
      overdueDays: Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 86400000)),
      isUnpaid: isUnpaidJob(job.status, balanceCents)
    };
  });

  const filtered = mapped.filter((job) => {
    if (filter === "unpaid") return job.isUnpaid;
    if (filter === "active") return !["CLOSED", "DELIVERED"].includes(job.status);
    return true;
  });

  return NextResponse.json({ jobs: filtered });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = createJobSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", detail: parsed.error.flatten() }, { status: 400 });
  }

  if (["INSURANCE", "MIXED"].includes(parsed.data.jobType) && !parsed.data.claim) {
    return NextResponse.json({ error: "Claim is required for Insurance and Mixed jobs" }, { status: 400 });
  }

  const settings = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings) return NextResponse.json({ error: "Shop settings missing" }, { status: 500 });

  const jobCount = await prisma.job.count();
  const jobNumber = makeJobNumber(jobCount + 1);

  const job = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: parsed.data.customer });

    const vehicle = await tx.vehicle.create({
      data: {
        customerId: customer.id,
        ...parsed.data.vehicle
      }
    });

    const createdJob = await tx.job.create({
      data: {
        jobNumber,
        customerId: customer.id,
        vehicleId: vehicle.id,
        jobType: parsed.data.jobType,
        status: "DRAFT",
        notesInternal: parsed.data.notesInternal
      }
    });

    await tx.estimate.create({
      data: {
        jobId: createdJob.id,
        bodyLaborRateCents: settings.defaultBodyLaborRateCents,
        paintLaborRateCents: settings.defaultPaintLaborRateCents,
        mechLaborRateCents: settings.defaultMechLaborRateCents,
        detailLaborRateCents: settings.defaultDetailLaborRateCents,
        partsMarkupRuleJson: settings.partsMarkupRuleJson,
        subletMarkupPercent: settings.subletMarkupPercent,
        materialsFormulaJson: settings.materialsFormulaJson,
        taxRatePercent: settings.defaultTaxRatePercent,
        totalWrittenCents: 0
      }
    });

    if (parsed.data.claim) {
      await tx.claim.create({
        data: {
          jobId: createdJob.id,
          carrierName: parsed.data.claim.carrierName,
          claimNumber: parsed.data.claim.claimNumber,
          adjusterName: parsed.data.claim.adjusterName,
          adjusterEmail: parsed.data.claim.adjusterEmail,
          adjusterPhone: parsed.data.claim.adjusterPhone
        }
      });
    }

    await tx.lienCase.create({
      data: {
        jobId: createdJob.id,
        status: "NONE"
      }
    });

    return createdJob;
  });

  return NextResponse.json({ job }, { status: 201 });
}

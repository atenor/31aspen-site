import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { computeBalance, sumByPayer } from "@/lib/calc/receivables";
import { evaluateLienRisk } from "@/lib/calc/lien";
import { computeStorageAccrual } from "@/lib/calc/storage";
import { computeEstimateTotals } from "@/lib/calc/estimate";
import { generateLienItemizedStatementPdf, generateLienNoticePdf } from "@/lib/pdf/templates";
import { saveFileBuffer } from "@/lib/storage/files";
import { centsToDollars } from "@/lib/utils";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      customer: true,
      estimate: { include: { lineItems: true } },
      payments: true,
      storageAccrual: true,
      lienCase: true
    }
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const settings = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings) return NextResponse.json({ error: "Settings not found" }, { status: 500 });

  const lienRules = settings.lienFlagRulesJson as any;
  const paid = sumByPayer(job.payments.map((entry) => ({ payerType: entry.payerType, amountCents: entry.amountCents }))).total;
  const balanceCents = computeBalance(job.estimate?.totalWrittenCents ?? 0, paid);

  let storageBillableDays = 0;
  if (job.storageAccrual) {
    const storage = computeStorageAccrual({
      startDate: job.storageAccrual.startDate,
      endDate: job.storageAccrual.endDate,
      graceDays: 0,
      dailyRateCents: job.storageAccrual.dailyRateCents
    });
    storageBillableDays = storage.billableDays;
  }

  const risk = evaluateLienRisk({
    balanceCents,
    completedDate: job.completedDate,
    storageBillableDays,
    overdueThresholdDays: lienRules.overdueDays ?? 15,
    storageThresholdDays: lienRules.storageDays ?? 10,
    pickupThresholdDays: lienRules.pickupDays ?? 7,
    deliveredDate: job.deliveredDate
  });

  const pdfBuffer = await generateLienNoticePdf({
    jobNumber: job.jobNumber,
    customerName: job.customer.name,
    balanceDue: `$${centsToDollars(balanceCents)}`,
    reason: risk.reason || "Outstanding account balance"
  });

  const noticeUrl = await saveFileBuffer(
    `jobs/${job.id}/docs/lien-notice-${Date.now()}.pdf`,
    Buffer.from(pdfBuffer)
  );

  const totals = job.estimate
    ? computeEstimateTotals(
        job.estimate.lineItems.map((line) => ({
          category: line.category,
          quantity: line.quantity,
          unitCostCents: line.unitCostCents,
          unitPriceCents: line.unitPriceCents,
          laborHours: line.laborHours,
          laborType: line.laborType
        })),
        {
          bodyLaborRateCents: job.estimate.bodyLaborRateCents,
          paintLaborRateCents: job.estimate.paintLaborRateCents,
          mechLaborRateCents: job.estimate.mechLaborRateCents,
          detailLaborRateCents: job.estimate.detailLaborRateCents,
          partsMarkupRule: job.estimate.partsMarkupRuleJson as any,
          subletMarkupPercent: job.estimate.subletMarkupPercent,
          taxRatePercent: job.estimate.taxRatePercent ?? undefined
        }
      )
    : {
        laborSubtotalCents: 0,
        partsSubtotalCents: 0,
        subletSubtotalCents: 0,
        materialsFeesSubtotalCents: 0,
        taxCents: 0,
        grandTotalCents: 0
      };

  const itemizedPdf = await generateLienItemizedStatementPdf({
    jobNumber: job.jobNumber,
    customerName: job.customer.name,
    laborSubtotal: `$${centsToDollars(totals.laborSubtotalCents)}`,
    partsSubtotal: `$${centsToDollars(totals.partsSubtotalCents)}`,
    subletSubtotal: `$${centsToDollars(totals.subletSubtotalCents)}`,
    otherSubtotal: `$${centsToDollars(totals.materialsFeesSubtotalCents)}`,
    taxSubtotal: `$${centsToDollars(totals.taxCents)}`,
    grandTotal: `$${centsToDollars(job.estimate?.totalWrittenCents ?? totals.grandTotalCents)}`,
    paymentsReceived: `$${centsToDollars(paid)}`,
    balanceDue: `$${centsToDollars(balanceCents)}`
  });

  const packetUrl = await saveFileBuffer(
    `jobs/${job.id}/docs/lien-itemized-${Date.now()}.pdf`,
    Buffer.from(itemizedPdf)
  );

  await prisma.document.create({
    data: {
      jobId: job.id,
      type: "LIEN_NOTICE",
      url: noticeUrl
    }
  });

  await prisma.document.create({
    data: {
      jobId: job.id,
      type: "LIEN_PACKET",
      url: packetUrl
    }
  });

  const lienCase = await prisma.lienCase.upsert({
    where: { jobId: job.id },
    update: {
      status: "NOTICE_SENT",
      riskReason: risk.reason,
      noticeSentAt: new Date()
    },
    create: {
      jobId: job.id,
      status: "NOTICE_SENT",
      riskReason: risk.reason,
      noticeSentAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      jobId: job.id,
      actorUserId: auth.session.userId,
      action: "GENERATE_LIEN_NOTICE",
      afterJson: { noticeUrl, packetUrl, risk }
    }
  });

  return NextResponse.json({ lienCase, noticeUrl, packetUrl });
}

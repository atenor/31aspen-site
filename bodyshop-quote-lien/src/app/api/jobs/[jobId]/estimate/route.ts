import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { saveEstimateSchema } from "@/lib/validators/estimate";
import { computeEstimateTotals } from "@/lib/calc/estimate";
import { refreshStorageAndLien } from "@/lib/workflows/lien";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.TECH, Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = saveEstimateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid estimate payload" }, { status: 400 });

  const estimate = await prisma.estimate.findUnique({ where: { jobId: params.jobId } });
  if (!estimate) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });

  const totals = computeEstimateTotals(
    parsed.data.lines.map((line) => ({
      category: line.category,
      quantity: line.quantity,
      unitCostCents: line.unitCostCents,
      unitPriceCents: line.unitPriceCents,
      laborHours: line.laborHours,
      laborType: line.laborType
    })),
    {
      bodyLaborRateCents: estimate.bodyLaborRateCents,
      paintLaborRateCents: estimate.paintLaborRateCents,
      mechLaborRateCents: estimate.mechLaborRateCents,
      detailLaborRateCents: estimate.detailLaborRateCents,
      partsMarkupRule: estimate.partsMarkupRuleJson as any,
      subletMarkupPercent: estimate.subletMarkupPercent,
      taxRatePercent: parsed.data.taxRatePercent ?? estimate.taxRatePercent ?? undefined
    }
  );

  const result = await prisma.$transaction(async (tx) => {
    await tx.estimateLineItem.deleteMany({ where: { estimateId: estimate.id } });

    await tx.estimateLineItem.createMany({
      data: parsed.data.lines.map((line) => ({
        estimateId: estimate.id,
        category: line.category,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitCostCents: line.unitCostCents,
        unitPriceCents: line.unitPriceCents,
        laborHours: line.laborHours,
        laborType: line.laborType,
        isCustomerFacing: line.isCustomerFacing,
        sortOrder: line.sortOrder
      }))
    });

    const updatedEstimate = await tx.estimate.update({
      where: { id: estimate.id },
      data: {
        taxRatePercent: parsed.data.taxRatePercent ?? estimate.taxRatePercent,
        totalWrittenCents: totals.grandTotalCents
      }
    });

    await tx.job.update({ where: { id: params.jobId }, data: { status: "ESTIMATE_READY" } });

    await tx.auditLog.create({
      data: {
        jobId: params.jobId,
        actorUserId: auth.session.userId,
        action: "UPDATE_ESTIMATE",
        afterJson: totals as any
      }
    });

    return updatedEstimate;
  });

  await refreshStorageAndLien(params.jobId);

  return NextResponse.json({ estimate: result, totals });
}

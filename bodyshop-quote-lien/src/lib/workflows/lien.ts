import { JobStatus, LienStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeBalance, sumByPayer } from "@/lib/calc/receivables";
import { evaluateLienRisk } from "@/lib/calc/lien";
import { computeStorageAccrual } from "@/lib/calc/storage";

function policyApplies(applies: "ALL" | "TOW_STORAGE_ONLY" | "UNPAID_ONLY", jobType: string, balanceCents: number) {
  if (applies === "ALL") return true;
  if (applies === "TOW_STORAGE_ONLY") return jobType === "TOW_STORAGE";
  return balanceCents > 0;
}

export async function refreshStorageAndLien(jobId: string) {
  const settings = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings) return null;

  const policyDefaults = settings.storagePolicyDefaultsJson as any;
  const lienRules = settings.lienFlagRulesJson as any;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      estimate: true,
      claim: true,
      payments: true,
      storageAccrual: true,
      lienCase: true
    }
  });
  if (!job) return null;

  const paid = sumByPayer(job.payments.map((entry) => ({ payerType: entry.payerType, amountCents: entry.amountCents })));
  const balanceCents = computeBalance(job.estimate?.totalWrittenCents ?? 0, paid.total);

  let storageBillableDays = 0;
  if (job.completedDate && policyApplies(policyDefaults.applies ?? "UNPAID_ONLY", job.jobType, balanceCents)) {
    const startDate = job.storageStartDate ?? job.completedDate;
    const accrual = computeStorageAccrual({
      startDate,
      graceDays: policyDefaults.graceDays ?? 3,
      dailyRateCents: policyDefaults.dailyRateCents ?? 0
    });

    storageBillableDays = accrual.billableDays;

    await prisma.storageAccrual.upsert({
      where: { jobId: job.id },
      update: {
        startDate,
        dailyRateCents: policyDefaults.dailyRateCents ?? 0,
        totalAccruedCents: accrual.totalAccruedCents
      },
      create: {
        jobId: job.id,
        startDate,
        dailyRateCents: policyDefaults.dailyRateCents ?? 0,
        totalAccruedCents: accrual.totalAccruedCents
      }
    });
  }

  const risk = evaluateLienRisk({
    balanceCents,
    completedDate: job.completedDate,
    deliveredDate: job.deliveredDate,
    storageBillableDays,
    overdueThresholdDays: lienRules.overdueDays ?? 15,
    storageThresholdDays: lienRules.storageDays ?? 10,
    pickupThresholdDays: lienRules.pickupDays ?? 7
  });

  const status: LienStatus = risk.status === "WATCH" ? "WATCH" : "NONE";

  await prisma.lienCase.upsert({
    where: { jobId: job.id },
    update: { status, riskReason: risk.reason ?? null },
    create: { jobId: job.id, status, riskReason: risk.reason ?? null }
  });

  return { balanceCents, riskStatus: status, riskReason: risk.reason ?? null };
}

export function isJobClosedForCollections(status: JobStatus) {
  return status === "COMPLETE" || status === "DELIVERED";
}

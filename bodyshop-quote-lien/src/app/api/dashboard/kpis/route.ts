import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { computeBalance, sumByPayer } from "@/lib/calc/receivables";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, [Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const jobs = await prisma.job.findMany({
    include: {
      estimate: true,
      claim: true,
      payments: true,
      storageAccrual: true,
      lienCase: true
    }
  });

  let written = 0;
  let approved = 0;
  let collected = 0;
  let outstandingInsurance = 0;
  let outstandingCustomer = 0;
  let storageAccrued = 0;
  let lienRiskCount = 0;
  let shortPay = 0;
  const lagDays: number[] = [];

  for (const job of jobs) {
    const totalWritten = job.estimate?.totalWrittenCents ?? 0;
    const paid = sumByPayer(job.payments.map((payment) => ({ payerType: payment.payerType, amountCents: payment.amountCents })));
    const balance = computeBalance(totalWritten, paid.total);

    written += totalWritten;
    approved += job.claim?.approvedAmountCents ?? 0;
    collected += paid.total;
    storageAccrued += job.storageAccrual?.totalAccruedCents ?? 0;
    if (job.lienCase && ["WATCH", "NOTICE_READY", "NOTICE_SENT", "FILE_READY", "FILED"].includes(job.lienCase.status)) lienRiskCount += 1;
    if (job.claim?.shortPayCents) shortPay += job.claim.shortPayCents;

    if (job.claim?.dateSent && job.claim?.approvedAmountCents) {
      lagDays.push(differenceInCalendarDays(new Date(), job.claim.dateSent));
    }

    if (balance > 0) {
      const insurancePaid = paid.INSURANCE;
      const customerPaid = paid.CUSTOMER;
      const insuranceShare = Math.max(0, (job.claim?.approvedAmountCents ?? 0) - insurancePaid);
      const customerShare = Math.max(0, balance - insuranceShare - customerPaid);
      outstandingInsurance += insuranceShare;
      outstandingCustomer += customerShare > 0 ? customerShare : balance;
    }
  }

  const avgInsuranceLagDays = lagDays.length ? Math.round(lagDays.reduce((a, b) => a + b, 0) / lagDays.length) : 0;

  return NextResponse.json({
    kpis: {
      written,
      approved,
      collected,
      outstandingInsurance,
      outstandingCustomer,
      storageAccrued,
      lienRiskCount,
      shortPay,
      avgInsuranceLagDays
    }
  });
}

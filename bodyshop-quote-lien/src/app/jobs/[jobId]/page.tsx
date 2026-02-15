import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/auth/page";
import { AppShell } from "@/components/app-shell";
import { JobWorkspace } from "@/components/job-workspace";
import { computeBalance, sumByPayer } from "@/lib/calc/receivables";

export default async function JobDetailPage({ params }: { params: { jobId: string } }) {
  const session = await requirePageSession();

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      customer: true,
      vehicle: true,
      claim: true,
      estimate: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
      photos: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { receivedAt: "desc" } },
      tasks: { orderBy: { dueAt: "asc" } },
      lienCase: true,
      authorizations: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!job) notFound();

  const paid = sumByPayer(job.payments.map((entry) => ({ payerType: entry.payerType, amountCents: entry.amountCents })));
  const balanceCents = computeBalance(job.estimate?.totalWrittenCents ?? 0, paid.total);

  return (
    <AppShell title={`Job ${job.jobNumber}`} role={session.role}>
      <JobWorkspace role={session.role} initial={{ job, balanceCents, paidBreakdown: paid }} />
    </AppShell>
  );
}

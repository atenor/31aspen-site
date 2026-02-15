import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/auth/page";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { computeBalance, computeAgingBucket, determineAgingAnchor, sumByPayer } from "@/lib/calc/receivables";

export default async function DashboardPage() {
  const session = await requirePageSession();
  if (session.role === "TECH") redirect("/shop-floor");

  const jobs = await prisma.job.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
      estimate: true,
      claim: true,
      payments: true,
      storageAccrual: true,
      lienCase: true,
      tasks: { where: { completedAt: null }, orderBy: { dueAt: "asc" }, take: 5 }
    }
  });

  let written = 0;
  let approved = 0;
  let collected = 0;
  let outstandingInsurance = 0;
  let outstandingCustomer = 0;
  let storageAccrued = 0;
  let lienRisk = 0;

  const aging = { "0-15": 0, "16-30": 0, "31-60": 0, "60+": 0 };

  const tasks = jobs.flatMap((job) => job.tasks.map((task) => ({ ...task, jobNumber: job.jobNumber })));

  for (const job of jobs) {
    const totalWritten = job.estimate?.totalWrittenCents ?? 0;
    const paid = sumByPayer(job.payments.map((entry) => ({ payerType: entry.payerType, amountCents: entry.amountCents })));
    const balance = computeBalance(totalWritten, paid.total);
    written += totalWritten;
    approved += job.claim?.approvedAmountCents ?? 0;
    collected += paid.total;
    storageAccrued += job.storageAccrual?.totalAccruedCents ?? 0;
    if (job.lienCase && ["WATCH", "NOTICE_READY", "NOTICE_SENT", "FILE_READY", "FILED"].includes(job.lienCase.status)) lienRisk += 1;

    if (balance > 0) {
      outstandingInsurance += Math.max(0, (job.claim?.approvedAmountCents ?? 0) - paid.INSURANCE);
      outstandingCustomer += Math.max(0, balance - Math.max(0, (job.claim?.approvedAmountCents ?? 0) - paid.INSURANCE));
      const bucket = computeAgingBucket(determineAgingAnchor(job.completedDate, job.claim?.dateSent));
      aging[bucket] += balance;
    }
  }

  const kpis = [
    ["Written", written],
    ["Approved", approved],
    ["Collected", collected],
    ["Outstanding Insurance", outstandingInsurance],
    ["Outstanding Customer", outstandingCustomer],
    ["Storage Accrued", storageAccrued],
    ["Lien Risk Count", lienRisk]
  ];

  return (
    <AppShell title="Owner / Helper Dashboard" role={session.role}>
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        {kpis.map(([label, value]) => (
          <Card key={String(label)}>
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{label === "Lien Risk Count" ? Number(value) : `$${(Number(value) / 100).toFixed(2)}`}</p>
          </Card>
        ))}
      </section>

      <section className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-lg font-semibold">Receivable Aging</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(aging).map(([bucket, amount]) => (
              <div key={bucket} className="flex items-center justify-between border-b pb-1">
                <span>{bucket} days</span>
                <span>${(amount / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-semibold">Follow-up Tasks</h3>
          <div className="space-y-2 text-sm">
            {tasks.length === 0 ? <p className="text-muted-foreground">No open tasks.</p> : null}
            {tasks.map((task) => (
              <div key={task.id} className="rounded border p-2">
                <p className="font-semibold">{task.jobNumber} · {task.type}</p>
                <p className="text-xs text-muted-foreground">Due {new Date(task.dueAt).toLocaleDateString()}</p>
                {task.note ? <p className="text-xs">{task.note}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <h3 className="mb-2 text-lg font-semibold">Jobs</h3>
          <div className="space-y-2">
            {jobs.slice(0, 15).map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between rounded border p-2 hover:bg-muted">
                <span>{job.jobNumber} · {job.customer.name}</span>
                <span className="text-xs">{job.status}</span>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

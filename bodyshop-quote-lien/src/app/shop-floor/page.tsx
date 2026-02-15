import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/auth/page";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { NewJobForm } from "@/components/new-job-form";
import { computeBalance, determineAgingAnchor, sumByPayer } from "@/lib/calc/receivables";

export default async function ShopFloorPage() {
  const session = await requirePageSession();

  const jobs = await prisma.job.findMany({
    take: 20,
    orderBy: { updatedAt: "desc" },
    include: { customer: true, estimate: true, payments: true, claim: true }
  });

  const active = jobs.filter((job) => !["DELIVERED", "CLOSED"].includes(job.status));
  const unpaid = jobs
    .map((job) => {
      const paid = sumByPayer(job.payments.map((entry) => ({ payerType: entry.payerType, amountCents: entry.amountCents })));
      const balance = computeBalance(job.estimate?.totalWrittenCents ?? 0, paid.total);
      const anchor = determineAgingAnchor(job.completedDate, job.claim?.dateSent);
      const days = Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 86400000));
      return { ...job, balance, days };
    })
    .filter((job) => job.balance > 0 && ["COMPLETE", "DELIVERED"].includes(job.status));

  return (
    <AppShell title="Shop Floor Mode" role={session.role}>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="bg-accent p-6 text-center"><p className="text-2xl font-bold">New Job</p><p className="text-sm">Create estimate fast</p></Card>
        <Card className="p-6 text-center"><p className="text-2xl font-bold">Active Jobs</p><p className="text-sm">{active.length} open</p></Card>
        <Card className="border-red-300 bg-red-50 p-6 text-center"><p className="text-2xl font-bold text-red-700">Unpaid Jobs</p><p className="text-sm text-red-700">{unpaid.length} need follow-up</p></Card>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xl">New Job</h2>
        <NewJobForm />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-lg font-semibold">Active Jobs</h3>
          <div className="space-y-2">
            {active.slice(0, 8).map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between rounded border p-2 hover:bg-muted">
                <span>{job.jobNumber} · {job.customer.name}</span>
                <span className="text-xs text-muted-foreground">{job.status}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-semibold text-red-700">Unpaid Jobs</h3>
          <div className="space-y-2">
            {unpaid.slice(0, 8).map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between rounded border border-red-300 p-2 hover:bg-red-50">
                <div>
                  <p className="font-semibold">{job.jobNumber} · {job.customer.name}</p>
                  <p className="text-xs text-red-700">${(job.balance / 100).toFixed(2)} · {job.days} days overdue</p>
                </div>
                <span className="text-xs font-semibold text-red-700">Open</span>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

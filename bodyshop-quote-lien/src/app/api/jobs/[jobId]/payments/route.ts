import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";
import { paymentEntrySchema } from "@/lib/validators/payment";
import { refreshStorageAndLien } from "@/lib/workflows/lien";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const auth = await requireRoles(request, [Role.OFFICE, Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = paymentEntrySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });

  const entry = await prisma.paymentLedgerEntry.create({
    data: {
      jobId: params.jobId,
      payerType: parsed.data.payerType,
      method: parsed.data.method,
      amountCents: parsed.data.amountCents,
      reference: parsed.data.reference,
      note: parsed.data.note,
      receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      jobId: params.jobId,
      actorUserId: auth.session.userId,
      action: "ADD_PAYMENT",
      afterJson: { amountCents: entry.amountCents, payerType: entry.payerType }
    }
  });

  await refreshStorageAndLien(params.jobId);

  return NextResponse.json({ entry }, { status: 201 });
}

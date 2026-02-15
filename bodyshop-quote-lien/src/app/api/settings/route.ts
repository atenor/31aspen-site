import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/rbac/guards";

const settingsSchema = z.object({
  defaultBodyLaborRateCents: z.number().int().positive(),
  defaultPaintLaborRateCents: z.number().int().positive(),
  defaultMechLaborRateCents: z.number().int().positive(),
  defaultDetailLaborRateCents: z.number().int().positive(),
  partsMarkupRuleJson: z.any(),
  subletMarkupPercent: z.number(),
  materialsFormulaJson: z.any(),
  defaultShopFeesJson: z.any(),
  defaultTaxRatePercent: z.number(),
  storagePolicyDefaultsJson: z.any(),
  lienFlagRulesJson: z.any(),
  releaseControlEnabled: z.boolean()
});

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, [Role.OWNER]);
  if (auth.error) return auth.error;

  const settings = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, [Role.OWNER]);
  if (auth.error) return auth.error;

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });

  const settings = await prisma.shopSettings.update({
    where: { id: "default" },
    data: parsed.data
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId,
      action: "UPDATE_SETTINGS",
      afterJson: settings as any
    }
  });

  return NextResponse.json({ settings });
}

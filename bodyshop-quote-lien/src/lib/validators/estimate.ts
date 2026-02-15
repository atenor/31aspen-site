import { EstimateCategory, LaborType } from "@prisma/client";
import { z } from "zod";

export const estimateLineSchema = z.object({
  category: z.nativeEnum(EstimateCategory),
  description: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  unitCostCents: z.number().int().optional().nullable(),
  unitPriceCents: z.number().int().optional().nullable(),
  laborHours: z.number().optional().nullable(),
  laborType: z.nativeEnum(LaborType).optional().nullable(),
  isCustomerFacing: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

export const saveEstimateSchema = z.object({
  lines: z.array(estimateLineSchema),
  taxRatePercent: z.number().optional()
});

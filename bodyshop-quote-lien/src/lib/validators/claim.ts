import { z } from "zod";

export const claimSchema = z.object({
  carrierName: z.string().min(1),
  claimNumber: z.string().min(1),
  adjusterName: z.string().optional(),
  adjusterEmail: z.string().email().optional().or(z.literal("")),
  adjusterPhone: z.string().optional(),
  approvedAmountCents: z.number().int().optional().nullable(),
  dateSent: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional()
});

import { PaymentMethod, PayerType } from "@prisma/client";
import { z } from "zod";

export const paymentEntrySchema = z.object({
  payerType: z.nativeEnum(PayerType),
  method: z.nativeEnum(PaymentMethod),
  amountCents: z.number().int().positive(),
  reference: z.string().optional(),
  note: z.string().optional(),
  receivedAt: z.string().datetime().optional()
});

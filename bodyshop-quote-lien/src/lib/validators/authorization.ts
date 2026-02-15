import { AuthorizationType } from "@prisma/client";
import { z } from "zod";

export const authorizationSchema = z.object({
  type: z.nativeEnum(AuthorizationType),
  signerName: z.string().min(1),
  signerEmail: z.string().email().optional().or(z.literal("")),
  signatureBase64: z.string().min(8),
  signatureTyped: z.string().optional()
});

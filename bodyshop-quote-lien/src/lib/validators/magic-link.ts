import { z } from "zod";

export const requestMagicLinkSchema = z.object({
  email: z.string().email()
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(20)
});

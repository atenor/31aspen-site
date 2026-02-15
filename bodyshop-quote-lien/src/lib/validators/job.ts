import { z } from "zod";
import { JobStatus, JobType } from "@prisma/client";

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  address: z.string().optional().nullable()
});

export const vehicleSchema = z.object({
  vin: z.string().optional().nullable(),
  year: z.number().int().gte(1900).lte(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional().nullable(),
  mileage: z.number().int().optional().nullable()
});

export const createJobSchema = z.object({
  customer: customerSchema,
  vehicle: vehicleSchema,
  jobType: z.nativeEnum(JobType),
  notesInternal: z.string().optional(),
  claim: z
    .object({
      carrierName: z.string().min(1),
      claimNumber: z.string().min(1),
      adjusterName: z.string().optional(),
      adjusterEmail: z.string().email().optional(),
      adjusterPhone: z.string().optional()
    })
    .optional()
});

export const statusUpdateSchema = z.object({
  status: z.nativeEnum(JobStatus),
  overrideReason: z.string().optional(),
  storageStartDate: z.string().datetime().optional()
});

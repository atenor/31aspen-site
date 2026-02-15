import { JobStatus } from "@prisma/client";

export function isUnpaidJob(status: JobStatus, balanceCents: number) {
  if (balanceCents <= 0) return false;
  return status === "COMPLETE" || status === "DELIVERED";
}

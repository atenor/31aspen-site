import { differenceInCalendarDays } from "date-fns";
import type { LienStatus } from "@prisma/client";

export function evaluateLienRisk(input: {
  balanceCents: number;
  completedDate?: Date | null;
  storageBillableDays?: number;
  overdueThresholdDays: number;
  storageThresholdDays: number;
  pickupThresholdDays: number;
  deliveredDate?: Date | null;
  now?: Date;
}): { status: LienStatus; reason?: string } {
  const now = input.now ?? new Date();
  const overdueDays = input.completedDate ? differenceInCalendarDays(now, input.completedDate) : 0;
  const pickedUp = Boolean(input.deliveredDate);

  if (input.balanceCents <= 0) return { status: "NONE" };
  if (overdueDays >= input.overdueThresholdDays) return { status: "WATCH", reason: "Balance overdue beyond threshold" };
  if ((input.storageBillableDays ?? 0) >= input.storageThresholdDays) return { status: "WATCH", reason: "Storage accrual beyond threshold" };
  if (!pickedUp && overdueDays >= input.pickupThresholdDays) return { status: "WATCH", reason: "Vehicle not picked up" };

  return { status: "NONE" };
}

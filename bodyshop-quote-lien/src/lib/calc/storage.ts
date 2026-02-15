import { differenceInCalendarDays } from "date-fns";

export function computeStorageAccrual(params: {
  startDate: Date;
  endDate?: Date | null;
  graceDays: number;
  dailyRateCents: number;
}) {
  const endDate = params.endDate ?? new Date();
  const totalDays = Math.max(0, differenceInCalendarDays(endDate, params.startDate));
  const billableDays = Math.max(0, totalDays - params.graceDays);
  const totalAccruedCents = billableDays * params.dailyRateCents;

  return {
    totalDays,
    billableDays,
    totalAccruedCents
  };
}

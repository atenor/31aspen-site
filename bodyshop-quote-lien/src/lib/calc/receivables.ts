import { differenceInCalendarDays } from "date-fns";

export type AgingBucket = "0-15" | "16-30" | "31-60" | "60+";

export function computeBalance(totalWrittenCents: number, paymentCents: number) {
  return totalWrittenCents - paymentCents;
}

export function determineAgingAnchor(completedDate?: Date | null, dateSent?: Date | null) {
  return dateSent ?? completedDate ?? new Date();
}

export function computeAgingBucket(anchorDate: Date, now = new Date()): AgingBucket {
  const days = Math.max(0, differenceInCalendarDays(now, anchorDate));
  if (days <= 15) return "0-15";
  if (days <= 30) return "16-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export function sumByPayer(
  entries: Array<{ payerType: "INSURANCE" | "CUSTOMER"; amountCents: number }>
) {
  return entries.reduce(
    (acc, entry) => {
      acc[entry.payerType] += entry.amountCents;
      acc.total += entry.amountCents;
      return acc;
    },
    { INSURANCE: 0, CUSTOMER: 0, total: 0 }
  );
}

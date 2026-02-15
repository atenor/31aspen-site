import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function makeJobNumber(seed: number) {
  return `BS-${String(seed).padStart(6, "0")}`;
}

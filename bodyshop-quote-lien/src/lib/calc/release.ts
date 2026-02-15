import { Role } from "@prisma/client";

export function canDeliverVehicle(input: {
  role: Role;
  balanceCents: number;
  releaseControlEnabled: boolean;
  overrideReason?: string;
}) {
  if (!input.releaseControlEnabled) return { allowed: true, overrideLogged: false };
  if (input.balanceCents <= 0) return { allowed: true, overrideLogged: false };
  if (input.role === Role.OWNER && input.overrideReason?.trim()) return { allowed: true, overrideLogged: true };
  return { allowed: false, overrideLogged: false };
}

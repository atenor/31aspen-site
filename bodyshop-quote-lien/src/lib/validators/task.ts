import { TaskType } from "@prisma/client";
import { z } from "zod";

export const taskSchema = z.object({
  type: z.nativeEnum(TaskType),
  dueAt: z.string().datetime(),
  assignedToUserId: z.string().optional().nullable(),
  note: z.string().optional()
});

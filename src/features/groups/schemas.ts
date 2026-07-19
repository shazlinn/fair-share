import { z } from "zod";

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters").max(80),
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters"),
  currency: z.literal("MYR"),
  timeZone: z.string().refine(isTimeZone, "Enter a valid IANA time zone"),
});

export const groupStatusChangeSchema = z.object({
  groupId: z.string().cuid(),
  expectedVersion: z.number().int().positive(),
  archived: z.boolean(),
});

export const removeMemberSchema = z.object({
  groupId: z.string().cuid(),
  memberUserId: z.string().cuid(),
});

export type CreateGroupInput = z.input<typeof createGroupSchema>;
export type GroupStatusChangeInput = z.infer<typeof groupStatusChangeSchema>;

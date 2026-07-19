import { z } from "zod";

export const createInvitationSchema = z.object({
  groupId: z.string().cuid(),
  maxUses: z.number().int().min(1).max(50),
  expiresInDays: z.number().int().min(1).max(30),
});

export const invitationTokenSchema = z.string().min(32).max(256);

export const revokeInvitationSchema = z.object({
  groupId: z.string().cuid(),
  invitationId: z.string().cuid(),
});

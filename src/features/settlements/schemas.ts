import { z } from "zod";

const memberIdSchema = z.string().cuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const settlementFieldsSchema = z.object({
  fromUserId: memberIdSchema,
  toUserId: memberIdSchema,
  amount: z.string().min(1).max(32),
  memo: z.string().trim().max(500),
  settledAt: dateSchema,
});

export const recordSettlementSchema = settlementFieldsSchema.extend({
  groupId: z.string().cuid(),
  idempotencyKey: z.uuid(),
});

export const voidSettlementSchema = z.object({
  groupId: z.string().cuid(),
  settlementId: z.string().cuid(),
  expectedVersion: z.number().int().positive(),
});

export type SettlementFieldsInput = z.infer<typeof settlementFieldsSchema>;

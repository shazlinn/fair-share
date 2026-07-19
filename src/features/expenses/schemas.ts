import { z } from "zod";

const memberIdSchema = z.string().cuid();
const moneyStringSchema = z.string().min(1).max(32);

const payerSchema = z.object({
  memberId: memberIdSchema,
  amount: moneyStringSchema,
});

const equalSplitSchema = z.object({
  method: z.literal("EQUAL"),
  participantIds: z.array(memberIdSchema).min(1).max(100),
});

const exactSplitSchema = z.object({
  method: z.literal("EXACT"),
  participants: z
    .array(z.object({ memberId: memberIdSchema, amount: moneyStringSchema }))
    .min(1)
    .max(100),
});

const percentageSplitSchema = z.object({
  method: z.literal("PERCENTAGE"),
  participants: z
    .array(z.object({ memberId: memberIdSchema, percentage: z.string().min(1).max(8) }))
    .min(1)
    .max(100),
});

const sharesSplitSchema = z.object({
  method: z.literal("SHARES"),
  participants: z
    .array(z.object({ memberId: memberIdSchema, shares: z.string().regex(/^\d{1,18}$/) }))
    .min(1)
    .max(100),
});

export const expenseSplitSchema = z.discriminatedUnion("method", [
  equalSplitSchema,
  exactSplitSchema,
  percentageSplitSchema,
  sharesSplitSchema,
]);

const expenseFieldsSchema = z.object({
  groupId: z.string().cuid(),
  description: z.string().trim().min(2, "Description must be at least 2 characters").max(120),
  notes: z.string().trim().max(1_000),
  amount: moneyStringSchema,
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"),
  payers: z.array(payerSchema).min(1).max(100),
  split: expenseSplitSchema,
});

export const createExpenseSchema = expenseFieldsSchema.extend({
  idempotencyKey: z.uuid(),
});

export const editExpenseSchema = expenseFieldsSchema.extend({
  expenseId: z.string().cuid(),
  expectedVersion: z.number().int().positive(),
});

export const deleteExpenseSchema = z.object({
  groupId: z.string().cuid(),
  expenseId: z.string().cuid(),
  expectedVersion: z.number().int().positive(),
});

export type ExpenseFieldsInput = z.infer<typeof expenseFieldsSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type EditExpenseInput = z.infer<typeof editExpenseSchema>;

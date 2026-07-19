import { z } from "zod";

export const receiptContextSchema = z.object({
  groupId: z.string().cuid(),
  expenseId: z.string().cuid(),
});

export const deleteReceiptSchema = receiptContextSchema.extend({
  attachmentId: z.string().cuid(),
});

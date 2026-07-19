import { z } from "zod";

export const createCommentSchema = z.object({
  groupId: z.string().cuid(),
  expenseId: z.string().cuid(),
  body: z.string().trim().min(1, "Comment cannot be empty").max(1_000),
});

export const deleteCommentSchema = z.object({
  groupId: z.string().cuid(),
  expenseId: z.string().cuid(),
  commentId: z.string().cuid(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

"use server";

import { createCommentSchema, deleteCommentSchema } from "@/features/comments/schemas";
import { notifyActiveGroupMembers } from "@/features/notifications/service";
import type { ActionResult } from "@/lib/action-result";
import { ApplicationError, getSafeErrorMessage } from "@/lib/errors";
import { requireUser } from "@/server/auth/guards";
import { runSerializable } from "@/server/db/transaction";

export async function createComment(input: unknown): Promise<ActionResult<{ commentId: string }>> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  }
  try {
    const user = await requireUser();
    const commentId = await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true, user: { select: { name: true, email: true } } },
      });
      if (!membership || membership.leftAt) throw new ApplicationError("NOT_FOUND", "Expense not found");
      if (membership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }
      const expense = await transaction.expense.findFirst({
        where: { id: parsed.data.expenseId, groupId: parsed.data.groupId, status: "ACTIVE" },
        select: { id: true, description: true },
      });
      if (!expense) throw new ApplicationError("NOT_FOUND", "Expense not found");

      const comment = await transaction.expenseComment.create({
        data: {
          groupId: parsed.data.groupId,
          expenseId: expense.id,
          authorId: user.id,
          body: parsed.data.body,
        },
      });
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "COMMENT_CREATED",
          entityType: "ExpenseComment",
          entityId: comment.id,
          metadata: { expenseId: expense.id },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "COMMENT_ADDED",
        title: `New comment on ${expense.description}`,
        body: `${membership.user.name || membership.user.email || "A member"} added a comment`,
        data: { expenseId: expense.id, commentId: comment.id },
      });
      return comment.id;
    });
    return { ok: true, data: { commentId } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function deleteComment(input: unknown): Promise<ActionResult> {
  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid comment deletion request" };
  try {
    const user = await requireUser();
    await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true },
      });
      if (!membership || membership.leftAt) throw new ApplicationError("NOT_FOUND", "Comment not found");
      if (membership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }
      const comment = await transaction.expenseComment.findFirst({
        where: {
          id: parsed.data.commentId,
          expenseId: parsed.data.expenseId,
          groupId: parsed.data.groupId,
          deletedAt: null,
        },
      });
      if (!comment) throw new ApplicationError("NOT_FOUND", "Comment not found");
      if (comment.authorId !== user.id && membership.role !== "OWNER") {
        throw new ApplicationError("FORBIDDEN", "Only the author or group owner can delete it");
      }
      const deleted = await transaction.expenseComment.updateMany({
        where: { id: comment.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (deleted.count !== 1) throw new ApplicationError("CONFLICT", "The comment changed. Refresh and try again.");
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "COMMENT_DELETED",
          entityType: "ExpenseComment",
          entityId: comment.id,
          metadata: { expenseId: parsed.data.expenseId },
        },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

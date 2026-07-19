"use server";

import { AllocationError } from "@/domain/money/allocate";
import { formatMinorUnits, MoneyInputError } from "@/domain/money/minor-units";
import { prepareExpense } from "@/features/expenses/normalize";
import {
  createExpenseSchema,
  deleteExpenseSchema,
  editExpenseSchema,
  type ExpenseFieldsInput,
} from "@/features/expenses/schemas";
import type { ActionResult } from "@/lib/action-result";
import { notifyActiveGroupMembers } from "@/features/notifications/service";
import { ApplicationError, getSafeErrorMessage } from "@/lib/errors";
import { requireUser } from "@/server/auth/guards";
import { runSerializable, type TransactionClient } from "@/server/db/transaction";

async function requireWritableMembership(
  transaction: TransactionClient,
  groupId: string,
  userId: string,
) {
  const membership = await transaction.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
  if (!membership || membership.leftAt) {
    throw new ApplicationError("NOT_FOUND", "Group not found");
  }
  if (membership.group.status === "ARCHIVED") {
    throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
  }
  return membership;
}

async function requireActiveExpenseMembers(
  transaction: TransactionClient,
  groupId: string,
  memberIds: readonly string[],
) {
  const uniqueIds = [...new Set(memberIds)];
  const count = await transaction.groupMember.count({
    where: { groupId, userId: { in: uniqueIds }, leftAt: null },
  });
  if (count !== uniqueIds.length) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Every payer and participant must be an active member of this group",
    );
  }
}

function prepareOrThrow(input: ExpenseFieldsInput) {
  try {
    return prepareExpense(input);
  } catch (error) {
    if (error instanceof AllocationError || error instanceof MoneyInputError) {
      throw new ApplicationError("VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

export async function createExpense(input: unknown): Promise<ActionResult<{ expenseId: string }>> {
  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense details" };
  }

  try {
    const prepared = prepareOrThrow(parsed.data);
    const user = await requireUser();
    const expenseId = await runSerializable(async (transaction) => {
      const membership = await requireWritableMembership(transaction, parsed.data.groupId, user.id);
      const existing = await transaction.expense.findUnique({
        where: {
          groupId_idempotencyKey: {
            groupId: parsed.data.groupId,
            idempotencyKey: parsed.data.idempotencyKey,
          },
        },
        select: { id: true, createdById: true },
      });
      if (existing) {
        if (existing.createdById !== user.id) {
          throw new ApplicationError("CONFLICT", "This request key has already been used");
        }
        return existing.id;
      }

      await requireActiveExpenseMembers(
        transaction,
        parsed.data.groupId,
        [...prepared.payers, ...prepared.splits].map((item) => item.memberId),
      );

      const expense = await transaction.expense.create({
        data: {
          groupId: parsed.data.groupId,
          description: prepared.description,
          notes: prepared.notes,
          amountMinor: prepared.amountMinor,
          currency: membership.group.currency,
          splitMethod: prepared.splitMethod,
          expenseDate: prepared.expenseDate,
          idempotencyKey: parsed.data.idempotencyKey,
          createdById: user.id,
          updatedById: user.id,
        },
      });
      await transaction.expensePayer.createMany({
        data: prepared.payers.map((payer) => ({
          expenseId: expense.id,
          groupId: parsed.data.groupId,
          userId: payer.memberId,
          amountMinor: payer.amountMinor,
        })),
      });
      await transaction.expenseSplit.createMany({
        data: prepared.splits.map((split) => ({
          expenseId: expense.id,
          groupId: parsed.data.groupId,
          userId: split.memberId,
          amountMinor: split.amountMinor,
          percentageBasisPoints: split.percentageBasisPoints,
          shareUnits: split.shareUnits,
        })),
      });
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "EXPENSE_CREATED",
          entityType: "Expense",
          entityId: expense.id,
          metadata: {
            description: expense.description,
            amountMinor: expense.amountMinor.toString(),
            currency: expense.currency,
            splitMethod: expense.splitMethod,
          },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "EXPENSE_CREATED",
        title: `New expense: ${expense.description}`,
        body: `${user.name || user.email || "A member"} added ${expense.currency} ${formatMinorUnits(prepared.amountMinor)}`,
        data: { expenseId: expense.id },
      });
      return expense.id;
    });
    return { ok: true, data: { expenseId } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function editExpense(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = editExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense details" };
  }

  try {
    const prepared = prepareOrThrow(parsed.data);
    const user = await requireUser();
    const version = await runSerializable(async (transaction) => {
      const membership = await requireWritableMembership(transaction, parsed.data.groupId, user.id);
      const existing = await transaction.expense.findFirst({
        where: { id: parsed.data.expenseId, groupId: parsed.data.groupId, status: "ACTIVE" },
      });
      if (!existing) throw new ApplicationError("NOT_FOUND", "Expense not found");
      if (existing.createdById !== user.id && membership.role !== "OWNER") {
        throw new ApplicationError("FORBIDDEN", "Only the expense creator or group owner can edit it");
      }

      await requireActiveExpenseMembers(
        transaction,
        parsed.data.groupId,
        [...prepared.payers, ...prepared.splits].map((item) => item.memberId),
      );
      const updated = await transaction.expense.updateMany({
        where: {
          id: existing.id,
          groupId: parsed.data.groupId,
          status: "ACTIVE",
          version: parsed.data.expectedVersion,
        },
        data: {
          description: prepared.description,
          notes: prepared.notes,
          amountMinor: prepared.amountMinor,
          splitMethod: prepared.splitMethod,
          expenseDate: prepared.expenseDate,
          updatedById: user.id,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ApplicationError("CONFLICT", "The expense changed. Refresh and try again.");
      }

      await transaction.expensePayer.deleteMany({ where: { expenseId: existing.id } });
      await transaction.expenseSplit.deleteMany({ where: { expenseId: existing.id } });
      await transaction.expensePayer.createMany({
        data: prepared.payers.map((payer) => ({
          expenseId: existing.id,
          groupId: parsed.data.groupId,
          userId: payer.memberId,
          amountMinor: payer.amountMinor,
        })),
      });
      await transaction.expenseSplit.createMany({
        data: prepared.splits.map((split) => ({
          expenseId: existing.id,
          groupId: parsed.data.groupId,
          userId: split.memberId,
          amountMinor: split.amountMinor,
          percentageBasisPoints: split.percentageBasisPoints,
          shareUnits: split.shareUnits,
        })),
      });

      const nextVersion = parsed.data.expectedVersion + 1;
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "EXPENSE_UPDATED",
          entityType: "Expense",
          entityId: existing.id,
          metadata: {
            previousAmountMinor: existing.amountMinor.toString(),
            amountMinor: prepared.amountMinor.toString(),
            version: nextVersion,
          },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "EXPENSE_UPDATED",
        title: `Expense updated: ${prepared.description}`,
        body: `${user.name || user.email || "A member"} updated an expense`,
        data: { expenseId: existing.id },
      });
      return nextVersion;
    });
    return { ok: true, data: { version } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function deleteExpense(input: unknown): Promise<ActionResult> {
  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid expense deletion request" };

  try {
    const user = await requireUser();
    await runSerializable(async (transaction) => {
      const membership = await requireWritableMembership(transaction, parsed.data.groupId, user.id);
      const expense = await transaction.expense.findFirst({
        where: { id: parsed.data.expenseId, groupId: parsed.data.groupId, status: "ACTIVE" },
      });
      if (!expense) throw new ApplicationError("NOT_FOUND", "Expense not found");
      if (expense.createdById !== user.id && membership.role !== "OWNER") {
        throw new ApplicationError("FORBIDDEN", "Only the expense creator or group owner can delete it");
      }

      const deleted = await transaction.expense.updateMany({
        where: {
          id: expense.id,
          groupId: parsed.data.groupId,
          status: "ACTIVE",
          version: parsed.data.expectedVersion,
        },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          deletedById: user.id,
          updatedById: user.id,
          version: { increment: 1 },
        },
      });
      if (deleted.count !== 1) {
        throw new ApplicationError("CONFLICT", "The expense changed. Refresh and try again.");
      }
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "EXPENSE_DELETED",
          entityType: "Expense",
          entityId: expense.id,
          metadata: {
            description: expense.description,
            amountMinor: expense.amountMinor.toString(),
            version: parsed.data.expectedVersion + 1,
          },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "EXPENSE_DELETED",
        title: `Expense deleted: ${expense.description}`,
        body: `${user.name || user.email || "A member"} deleted an expense`,
        data: { expenseId: expense.id },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

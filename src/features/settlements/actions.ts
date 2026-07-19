"use server";

import { parseMinorUnits, MoneyInputError } from "@/domain/money/minor-units";
import {
  SettlementValidationError,
  validateSettlement,
} from "@/domain/settlements/validate-settlement";
import { readGroupFinancialSnapshot } from "@/features/settlements/balance-query";
import { notifyActiveGroupMembers } from "@/features/notifications/service";
import {
  canRecordSettlement,
  canVoidSettlement,
} from "@/features/settlements/authorization";
import { recordSettlementSchema, voidSettlementSchema } from "@/features/settlements/schemas";
import type { ActionResult } from "@/lib/action-result";
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
  if (!membership || membership.leftAt) throw new ApplicationError("NOT_FOUND", "Group not found");
  if (membership.group.status === "ARCHIVED") {
    throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
  }
  return membership;
}

function parseSettlementDate(input: string) {
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new ApplicationError("VALIDATION_ERROR", "Settlement date is invalid");
  }
  return date;
}

export async function recordSettlement(
  input: unknown,
): Promise<ActionResult<{ settlementId: string }>> {
  const parsed = recordSettlementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid repayment details" };
  }

  try {
    let amountMinor: bigint;
    try {
      amountMinor = parseMinorUnits(parsed.data.amount);
    } catch (error) {
      if (error instanceof MoneyInputError) {
        throw new ApplicationError("VALIDATION_ERROR", error.message);
      }
      throw error;
    }
    const settledAt = parseSettlementDate(parsed.data.settledAt);
    const user = await requireUser();
    const settlementId = await runSerializable(async (transaction) => {
      const membership = await requireWritableMembership(transaction, parsed.data.groupId, user.id);
      const existing = await transaction.settlement.findUnique({
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
      if (!canRecordSettlement(user.id, membership.role, parsed.data.fromUserId, parsed.data.toUserId)) {
        throw new ApplicationError("FORBIDDEN", "You must be a party to the repayment");
      }

      const snapshot = await readGroupFinancialSnapshot(transaction, parsed.data.groupId);
      try {
        validateSettlement(snapshot.balances, {
          fromMemberId: parsed.data.fromUserId,
          toMemberId: parsed.data.toUserId,
          amountMinor,
        });
      } catch (error) {
        if (error instanceof SettlementValidationError) {
          throw new ApplicationError("VALIDATION_ERROR", error.message);
        }
        throw error;
      }

      const settlement = await transaction.settlement.create({
        data: {
          groupId: parsed.data.groupId,
          fromUserId: parsed.data.fromUserId,
          toUserId: parsed.data.toUserId,
          amountMinor,
          currency: membership.group.currency,
          memo: parsed.data.memo || null,
          settledAt,
          idempotencyKey: parsed.data.idempotencyKey,
          createdById: user.id,
        },
      });
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "SETTLEMENT_RECORDED",
          entityType: "Settlement",
          entityId: settlement.id,
          metadata: {
            fromUserId: settlement.fromUserId,
            toUserId: settlement.toUserId,
            amountMinor: settlement.amountMinor.toString(),
            currency: settlement.currency,
          },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "SETTLEMENT_RECORDED",
        title: "Repayment recorded",
        body: `${user.name || user.email || "A member"} recorded a ${settlement.currency} repayment`,
        data: { settlementId: settlement.id },
      });
      return settlement.id;
    });
    return { ok: true, data: { settlementId } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function voidSettlement(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = voidSettlementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid repayment void request" };

  try {
    const user = await requireUser();
    const version = await runSerializable(async (transaction) => {
      const membership = await requireWritableMembership(transaction, parsed.data.groupId, user.id);
      const settlement = await transaction.settlement.findFirst({
        where: { id: parsed.data.settlementId, groupId: parsed.data.groupId, status: "RECORDED" },
      });
      if (!settlement) throw new ApplicationError("NOT_FOUND", "Repayment not found");
      if (!canVoidSettlement(user.id, membership.role, settlement.createdById)) {
        throw new ApplicationError("FORBIDDEN", "Only the recorder or group owner can void it");
      }

      const voided = await transaction.settlement.updateMany({
        where: {
          id: settlement.id,
          groupId: parsed.data.groupId,
          status: "RECORDED",
          version: parsed.data.expectedVersion,
        },
        data: { status: "VOIDED", voidedAt: new Date(), version: { increment: 1 } },
      });
      if (voided.count !== 1) {
        throw new ApplicationError("CONFLICT", "The repayment changed. Refresh and try again.");
      }

      const nextVersion = parsed.data.expectedVersion + 1;
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "SETTLEMENT_VOIDED",
          entityType: "Settlement",
          entityId: settlement.id,
          metadata: {
            amountMinor: settlement.amountMinor.toString(),
            version: nextVersion,
          },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "SETTLEMENT_VOIDED",
        title: "Repayment voided",
        body: `${user.name || user.email || "A member"} voided a repayment`,
        data: { settlementId: settlement.id },
      });
      return nextVersion;
    });
    return { ok: true, data: { version } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

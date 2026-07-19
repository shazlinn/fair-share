import type { DebtTransfer, NetBalance } from "@/domain/balances/simplify-debts";

export class SettlementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementValidationError";
  }
}

export function validateSettlement(
  balances: readonly NetBalance[],
  settlement: DebtTransfer,
): DebtTransfer {
  if (settlement.amountMinor <= 0n) {
    throw new SettlementValidationError("Settlement amount must be positive");
  }
  if (settlement.fromMemberId === settlement.toMemberId) {
    throw new SettlementValidationError("Settlement parties must be different members");
  }

  const balanceByMember = new Map<string, bigint>();
  for (const balance of balances) {
    if (!balance.memberId || balanceByMember.has(balance.memberId)) {
      throw new SettlementValidationError("Member IDs must be non-empty and unique");
    }
    balanceByMember.set(balance.memberId, balance.netMinor);
  }

  const senderNet = balanceByMember.get(settlement.fromMemberId);
  const receiverNet = balanceByMember.get(settlement.toMemberId);
  if (senderNet === undefined || receiverNet === undefined) {
    throw new SettlementValidationError("Settlement parties must belong to the group");
  }
  if (senderNet >= 0n) {
    throw new SettlementValidationError("Settlement sender does not have an outstanding debt");
  }
  if (receiverNet <= 0n) {
    throw new SettlementValidationError("Settlement receiver does not have an outstanding credit");
  }

  const senderOutstanding = -senderNet;
  if (
    settlement.amountMinor > senderOutstanding ||
    settlement.amountMinor > receiverNet
  ) {
    throw new SettlementValidationError("Settlement exceeds the current outstanding amount");
  }

  return { ...settlement };
}

export type NetBalance = Readonly<{
  memberId: string;
  netMinor: bigint;
}>;

export type DebtTransfer = Readonly<{
  fromMemberId: string;
  toMemberId: string;
  amountMinor: bigint;
}>;

export class DebtSimplificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DebtSimplificationError";
  }
}

type OutstandingParty = {
  memberId: string;
  remainingMinor: bigint;
};

function compareParties(left: OutstandingParty, right: OutstandingParty): number {
  if (left.remainingMinor > right.remainingMinor) return -1;
  if (left.remainingMinor < right.remainingMinor) return 1;
  if (left.memberId < right.memberId) return -1;
  if (left.memberId > right.memberId) return 1;
  return 0;
}

function validateBalances(balances: readonly NetBalance[]) {
  const memberIds = new Set<string>();
  let netTotal = 0n;

  for (const balance of balances) {
    if (!balance.memberId || memberIds.has(balance.memberId)) {
      throw new DebtSimplificationError("Member IDs must be non-empty and unique");
    }
    memberIds.add(balance.memberId);
    netTotal += balance.netMinor;
  }

  if (netTotal !== 0n) {
    throw new DebtSimplificationError("Net balances must sum to zero");
  }
}

export function simplifyDebts(balances: readonly NetBalance[]): DebtTransfer[] {
  validateBalances(balances);

  const debtors: OutstandingParty[] = balances
    .filter((balance) => balance.netMinor < 0n)
    .map((balance) => ({
      memberId: balance.memberId,
      remainingMinor: -balance.netMinor,
    }))
    .sort(compareParties);

  const creditors: OutstandingParty[] = balances
    .filter((balance) => balance.netMinor > 0n)
    .map((balance) => ({
      memberId: balance.memberId,
      remainingMinor: balance.netMinor,
    }))
    .sort(compareParties);

  const transfers: DebtTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    if (!debtor || !creditor) {
      throw new DebtSimplificationError("Debt matching reached an invalid state");
    }

    const amountMinor =
      debtor.remainingMinor < creditor.remainingMinor
        ? debtor.remainingMinor
        : creditor.remainingMinor;

    if (amountMinor <= 0n) {
      throw new DebtSimplificationError("Debt matching produced a non-positive transfer");
    }

    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountMinor,
    });

    debtor.remainingMinor -= amountMinor;
    creditor.remainingMinor -= amountMinor;

    if (debtor.remainingMinor === 0n) debtorIndex += 1;
    if (creditor.remainingMinor === 0n) creditorIndex += 1;
  }

  const unmatchedDebt = debtors.some((debtor) => debtor.remainingMinor !== 0n);
  const unmatchedCredit = creditors.some((creditor) => creditor.remainingMinor !== 0n);
  if (unmatchedDebt || unmatchedCredit) {
    throw new DebtSimplificationError("Debt matching did not preserve all balances");
  }

  return transfers;
}

export type MemberAmount = Readonly<{
  memberId: string;
  amountMinor: bigint;
}>;

export type SettlementFact = Readonly<{
  fromMemberId: string;
  toMemberId: string;
  amountMinor: bigint;
}>;

export type MemberBalance = Readonly<{
  memberId: string;
  paidMinor: bigint;
  shareMinor: bigint;
  sentMinor: bigint;
  receivedMinor: bigint;
  netMinor: bigint;
}>;

export type BalanceCalculationInput = Readonly<{
  memberIds: readonly string[];
  payments: readonly MemberAmount[];
  shares: readonly MemberAmount[];
  settlements: readonly SettlementFact[];
}>;

export class BalanceCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceCalculationError";
  }
}

function compareMemberIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function requireKnownMember(members: Map<string, MutableBalance>, memberId: string) {
  const member = members.get(memberId);
  if (!member) {
    throw new BalanceCalculationError(`Unknown member: ${memberId || "<empty>"}`);
  }
  return member;
}

type MutableBalance = {
  memberId: string;
  paidMinor: bigint;
  shareMinor: bigint;
  sentMinor: bigint;
  receivedMinor: bigint;
};

export function calculateBalances(input: BalanceCalculationInput): MemberBalance[] {
  const members = new Map<string, MutableBalance>();

  for (const memberId of input.memberIds) {
    if (!memberId || members.has(memberId)) {
      throw new BalanceCalculationError("Member IDs must be non-empty and unique");
    }
    members.set(memberId, {
      memberId,
      paidMinor: 0n,
      shareMinor: 0n,
      sentMinor: 0n,
      receivedMinor: 0n,
    });
  }

  let totalPaid = 0n;
  for (const payment of input.payments) {
    if (payment.amountMinor <= 0n) {
      throw new BalanceCalculationError("Payment amounts must be positive");
    }
    const member = requireKnownMember(members, payment.memberId);
    member.paidMinor += payment.amountMinor;
    totalPaid += payment.amountMinor;
  }

  let totalShares = 0n;
  for (const share of input.shares) {
    if (share.amountMinor < 0n) {
      throw new BalanceCalculationError("Share amounts cannot be negative");
    }
    const member = requireKnownMember(members, share.memberId);
    member.shareMinor += share.amountMinor;
    totalShares += share.amountMinor;
  }

  if (totalPaid !== totalShares) {
    throw new BalanceCalculationError("Total payments must equal total personal shares");
  }

  for (const settlement of input.settlements) {
    if (settlement.amountMinor <= 0n) {
      throw new BalanceCalculationError("Settlement amounts must be positive");
    }
    if (settlement.fromMemberId === settlement.toMemberId) {
      throw new BalanceCalculationError("Settlement parties must be different members");
    }

    const sender = requireKnownMember(members, settlement.fromMemberId);
    const receiver = requireKnownMember(members, settlement.toMemberId);
    sender.sentMinor += settlement.amountMinor;
    receiver.receivedMinor += settlement.amountMinor;
  }

  const result = [...members.values()]
    .map((member) => ({
      ...member,
      netMinor:
        member.paidMinor - member.shareMinor + member.sentMinor - member.receivedMinor,
    }))
    .sort((left, right) => compareMemberIds(left.memberId, right.memberId));

  const netTotal = result.reduce((sum, balance) => sum + balance.netMinor, 0n);
  if (netTotal !== 0n) {
    throw new BalanceCalculationError("Calculated group balances do not sum to zero");
  }

  return result;
}

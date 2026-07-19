import { calculateBalances, type MemberBalance } from "@/domain/balances/calculate-balances";
import { simplifyDebts, type DebtTransfer } from "@/domain/balances/simplify-debts";
import type { PrismaClient } from "@/generated/prisma/client";

type FinancialReader = Pick<PrismaClient, "groupMember" | "expense" | "settlement">;

export type FinancialMember = Readonly<{
  userId: string;
  name: string;
  email: string;
  active: boolean;
}>;

export type GroupFinancialSnapshot = Readonly<{
  members: readonly FinancialMember[];
  balances: readonly MemberBalance[];
  transfers: readonly DebtTransfer[];
}>;

export async function readGroupFinancialSnapshot(
  database: FinancialReader,
  groupId: string,
): Promise<GroupFinancialSnapshot> {
  const [memberships, expenses, settlements] = await Promise.all([
    database.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    database.expense.findMany({
      where: { groupId, status: "ACTIVE" },
      include: { payers: true, splits: true },
    }),
    database.settlement.findMany({ where: { groupId, status: "RECORDED" } }),
  ]);

  const balances = calculateBalances({
    memberIds: memberships.map((membership) => membership.userId),
    payments: expenses.flatMap((expense) =>
      expense.payers.map((payer) => ({ memberId: payer.userId, amountMinor: payer.amountMinor })),
    ),
    shares: expenses.flatMap((expense) =>
      expense.splits.map((split) => ({ memberId: split.userId, amountMinor: split.amountMinor })),
    ),
    settlements: settlements.map((settlement) => ({
      fromMemberId: settlement.fromUserId,
      toMemberId: settlement.toUserId,
      amountMinor: settlement.amountMinor,
    })),
  });

  return {
    members: memberships.map((membership) => ({
      userId: membership.userId,
      name: membership.user.name || membership.user.email || "Former member",
      email: membership.user.email || "",
      active: membership.leftAt === null,
    })),
    balances,
    transfers: simplifyDebts(balances),
  };
}

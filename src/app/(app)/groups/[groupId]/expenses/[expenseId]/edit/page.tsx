import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinorUnits } from "@/domain/money/minor-units";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { requireWritableGroup } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

function formatBasisPoints(value: number) {
  const whole = Math.floor(value / 100);
  const fraction = value % 100;
  return fraction ? `${whole}.${fraction.toString().padStart(2, "0")}` : whole.toString();
}

export default async function EditExpensePage({ params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const { groupId, expenseId } = await params;
  const context = await requireWritableGroup(groupId).catch(() => null);
  if (!context) notFound();
  const [expense, members] = await Promise.all([
    prisma.expense.findFirst({ where: { id: expenseId, groupId, status: "ACTIVE" }, include: { payers: true, splits: true } }),
    prisma.groupMember.findMany({ where: { groupId, leftAt: null }, include: { user: { select: { name: true, email: true } } }, orderBy: [{ role: "asc" }, { joinedAt: "asc" }] }),
  ]);
  if (!expense || (expense.createdById !== context.user.id && context.membership.role !== "OWNER")) notFound();
  return <div className="mx-auto max-w-3xl"><Card><CardHeader><CardTitle>Edit expense</CardTitle><CardDescription>Saving replaces all payer and participant allocations in one database transaction.</CardDescription></CardHeader><CardContent><ExpenseForm groupId={groupId} currentUserId={context.user.id} members={members.map((member) => ({ id: member.userId, name: member.user.name || member.user.email || "Member", email: member.user.email || "" }))} initial={{ expenseId: expense.id, version: expense.version, description: expense.description, notes: expense.notes || "", amount: formatMinorUnits(expense.amountMinor), expenseDate: expense.expenseDate.toISOString().slice(0, 10), splitMethod: expense.splitMethod, payers: expense.payers.map((payer) => ({ memberId: payer.userId, value: formatMinorUnits(payer.amountMinor) })), participants: expense.splits.map((split) => ({ memberId: split.userId, value: expense.splitMethod === "EQUAL" ? "selected" : expense.splitMethod === "EXACT" ? formatMinorUnits(split.amountMinor) : expense.splitMethod === "PERCENTAGE" ? formatBasisPoints(split.percentageBasisPoints ?? 0) : (split.shareUnits ?? 0n).toString() })) }} /></CardContent></Card></div>;
}

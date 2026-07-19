import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { requireWritableGroup } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export default async function NewExpensePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const context = await requireWritableGroup(groupId).catch(() => null);
  if (!context) notFound();
  const members = await prisma.groupMember.findMany({
    where: { groupId, leftAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  const todayInGroup = new Intl.DateTimeFormat("en-CA", {
    timeZone: context.group.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return <div className="mx-auto max-w-3xl"><Card><CardHeader><CardTitle>Add expense</CardTitle><CardDescription>All amounts are validated and allocated on the server in {context.group.currency} minor units.</CardDescription></CardHeader><CardContent><ExpenseForm groupId={groupId} currentUserId={context.user.id} defaultExpenseDate={todayInGroup} members={members.map((member) => ({ id: member.userId, name: member.user.name || member.user.email || "Member", email: member.user.email || "" }))} /></CardContent></Card></div>;
}

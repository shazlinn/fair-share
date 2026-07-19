import { notFound } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatMinorUnits } from "@/domain/money/minor-units";
import { ExpenseTable } from "@/features/expenses/expense-table";
import { GroupStatusControl } from "@/features/groups/group-status-control";
import { RemoveMemberButton } from "@/features/groups/remove-member-button";
import { InvitationCreator, RevokeInvitationButton } from "@/features/invitations/invitation-manager";
import { readGroupFinancialSnapshot } from "@/features/settlements/balance-query";
import { SettlementForm } from "@/features/settlements/settlement-form";
import { VoidSettlementButton } from "@/features/settlements/void-settlement-button";
import { requireActiveMembership } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const context = await requireActiveMembership(groupId).catch(() => null);
  if (!context) notFound();

  const isOwner = context.membership.role === "OWNER";
  const [members, activities, invitations, expenses, financials, settlementHistory] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId, leftAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    prisma.activityLog.findMany({
      where: { groupId },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    isOwner
      ? prisma.groupInvitation.findMany({
          where: { groupId },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    prisma.expense.findMany({
      where: { groupId, status: "ACTIVE" },
      include: { payers: { include: { member: { include: { user: { select: { name: true, email: true } } } } } } },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    readGroupFinancialSnapshot(prisma, groupId),
    prisma.settlement.findMany({
      where: { groupId },
      include: {
        fromMember: { include: { user: { select: { name: true, email: true } } } },
        toMember: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: [{ settledAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const group = context.group;
  const archived = group.status === "ARCHIVED";
  const nameByUserId = new Map(financials.members.map((member) => [member.userId, member.name]));
  const recordableTransfers = financials.transfers.filter(
    (transfer) =>
      isOwner || transfer.fromMemberId === context.user.id || transfer.toMemberId === context.user.id,
  );
  const todayInGroup = new Intl.DateTimeFormat("en-CA", {
    timeZone: group.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><div className="flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>{archived ? <Badge variant="secondary">Archived</Badge> : null}</div><p className="mt-2 max-w-2xl text-muted-foreground">{group.description || "No description"}</p><p className="mt-3 text-sm text-muted-foreground">{group.currency} · {group.timeZone} · {members.length} {members.length === 1 ? "member" : "members"}</p></div>
        {isOwner ? <GroupStatusControl groupId={group.id} version={group.version} archived={archived} /> : null}
      </header>

      {archived ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This group is archived. All member and invitation changes are disabled until the owner restores it.</div> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Group balances</CardTitle><CardDescription>Paid minus personal share, adjusted by recorded repayments.</CardDescription></CardHeader>
          <CardContent>{financials.balances.length ? <div className="space-y-3">{financials.balances.map((balance) => {
            const member = financials.members.find((item) => item.userId === balance.memberId);
            return <div key={balance.memberId} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0"><div className="min-w-0"><p className="truncate font-medium">{member?.name || "Member"}{member && !member.active ? <span className="ml-2 text-xs font-normal text-muted-foreground">Former member</span> : null}</p><p className="text-xs text-muted-foreground">Paid {group.currency} {formatMinorUnits(balance.paidMinor)} · Share {group.currency} {formatMinorUnits(balance.shareMinor)}</p></div><div className={`text-right font-semibold tabular-nums ${balance.netMinor > 0n ? "text-emerald-700" : balance.netMinor < 0n ? "text-destructive" : "text-muted-foreground"}`}>{balance.netMinor > 0n ? `gets ${group.currency} ${formatMinorUnits(balance.netMinor)}` : balance.netMinor < 0n ? `owes ${group.currency} ${formatMinorUnits(-balance.netMinor)}` : "settled"}</div></div>;
          })}</div> : <p className="text-sm text-muted-foreground">No members found.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Record a repayment</CardTitle><CardDescription>Suggested transfers simplify the group’s current outstanding debts.</CardDescription></CardHeader>
          <CardContent>{archived ? <p className="text-sm text-muted-foreground">Restore this group to record repayments.</p> : <SettlementForm groupId={groupId} currentUserId={context.user.id} canRecordAny={isOwner} defaultDate={todayInGroup} members={financials.members.map((member) => ({ id: member.userId, name: member.name, active: member.active }))} suggestions={recordableTransfers.map((transfer) => ({ fromUserId: transfer.fromMemberId, toUserId: transfer.toMemberId, amount: formatMinorUnits(transfer.amountMinor), label: `${nameByUserId.get(transfer.fromMemberId) || "Member"} pays ${nameByUserId.get(transfer.toMemberId) || "Member"} ${group.currency} ${formatMinorUnits(transfer.amountMinor)}` }))} />}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Repayment history</CardTitle><CardDescription>Voided repayments remain visible but no longer affect balances.</CardDescription></CardHeader>
        <CardContent>{settlementHistory.length ? <div className="space-y-3">{settlementHistory.map((settlement) => {
          const canVoid = !archived && settlement.status === "RECORDED" && (isOwner || settlement.createdById === context.user.id);
          return <div key={settlement.id} className="flex flex-col justify-between gap-3 border-b pb-3 last:border-0 sm:flex-row sm:items-center"><div><p className="text-sm"><strong>{settlement.fromMember.user.name || settlement.fromMember.user.email}</strong> paid <strong>{settlement.toMember.user.name || settlement.toMember.user.email}</strong> <span className="font-semibold tabular-nums">{settlement.currency} {formatMinorUnits(settlement.amountMinor)}</span></p><p className="mt-1 text-xs text-muted-foreground">{settlement.settledAt.toLocaleDateString("en-MY", { timeZone: "UTC" })}{settlement.memo ? ` · ${settlement.memo}` : ""} · <span className={settlement.status === "VOIDED" ? "text-destructive" : ""}>{settlement.status.toLowerCase()}</span></p></div>{canVoid ? <VoidSettlementButton groupId={groupId} settlementId={settlement.id} version={settlement.version} /> : null}</div>;
        })}</div> : <div className="rounded-lg border border-dashed p-6 text-center"><p className="font-medium">No repayments recorded</p><p className="mt-1 text-sm text-muted-foreground">Suggested transfers appear once the group has an outstanding balance.</p></div>}</CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Expenses</CardTitle><CardDescription>Shared costs recorded for this group.</CardDescription></div>{!archived ? <Button asChild><Link href={`/groups/${groupId}/expenses/new`}>Add expense</Link></Button> : null}</CardHeader>
        <CardContent>{expenses.length ? <ExpenseTable groupId={groupId} rows={expenses.map((expense) => ({ id: expense.id, description: expense.description, date: expense.expenseDate.toLocaleDateString("en-MY", { timeZone: "UTC" }), dateSort: expense.expenseDate.getTime(), paidBy: expense.payers.map((payer) => payer.member.user.name || payer.member.user.email || "Member").join(", "), amount: `${expense.currency} ${formatMinorUnits(expense.amountMinor)}`, amountMinor: expense.amountMinor.toString() }))} /> : <div className="rounded-lg border border-dashed p-8 text-center"><p className="font-medium">No expenses yet</p><p className="mt-1 text-sm text-muted-foreground">Add the first shared expense to start calculating balances.</p></div>}</CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Members</CardTitle><CardDescription>Only active members can access this group.</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {members.map((member, index) => (
              <div key={member.id}>
                {index ? <Separator /> : null}
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0"><p className="truncate font-medium">{member.user.name || member.user.email}</p><p className="truncate text-sm text-muted-foreground">{member.user.email}</p></div>
                  <div className="flex items-center gap-2"><Badge variant="outline">{member.role === "OWNER" ? "Owner" : "Member"}</Badge>{isOwner && !archived && member.role === "MEMBER" ? <RemoveMemberButton groupId={groupId} memberUserId={member.userId} /> : null}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {isOwner ? (
          <Card>
            <CardHeader><CardTitle>Invitation links</CardTitle><CardDescription>Secrets are hashed in the database and shown only when created.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              {!archived ? <InvitationCreator groupId={groupId} /> : null}
              <Separator />
              {invitations.length ? <div className="space-y-3">{invitations.map((invitation) => {
                const active = !invitation.revokedAt && invitation.expiresAt > new Date() && invitation.useCount < invitation.maxUses;
                return <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{invitation.useCount}/{invitation.maxUses} uses</p><p className="text-xs text-muted-foreground">Expires {invitation.expiresAt.toLocaleDateString("en-MY")}</p></div><div className="flex items-center gap-2"><Badge variant={active ? "outline" : "secondary"}>{active ? "Active" : "Closed"}</Badge>{active && !archived ? <RevokeInvitationButton groupId={groupId} invitationId={invitation.id} /> : null}</div></div>;
              })}</div> : <p className="text-sm text-muted-foreground">No invitation links created.</p>}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Recent activity</CardTitle><CardDescription>Significant group and membership actions are recorded here.</CardDescription></div><Button variant="outline" asChild><Link href={`/groups/${groupId}/activity`}>View all</Link></Button></CardHeader>
        <CardContent>{activities.length ? <div className="space-y-3">{activities.map((activity) => <div key={activity.id} className="flex flex-col justify-between gap-1 border-b pb-3 text-sm last:border-0 sm:flex-row"><span><strong>{activity.actor?.name || activity.actor?.email || "System"}</strong> {activity.action.toLowerCase().replaceAll("_", " ")}</span><time className="text-muted-foreground">{activity.createdAt.toLocaleString("en-MY")}</time></div>)}</div> : <p className="text-sm text-muted-foreground">No activity yet.</p>}</CardContent>
      </Card>
    </div>
  );
}

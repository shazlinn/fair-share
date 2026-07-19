import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateGroupForm } from "@/features/groups/create-group-form";
import { buildDashboardAnalytics, toChartMajorUnits } from "@/features/analytics/dashboard-analytics";
import { SpendingCharts } from "@/features/analytics/spending-charts";
import { formatMinorUnits } from "@/domain/money/minor-units";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export default async function DashboardPage() {
  const user = await requireUser();
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id, leftAt: null },
    include: { group: true },
    orderBy: { joinedAt: "desc" },
  });
  const groupIds = memberships.map((membership) => membership.groupId);
  const expenses = groupIds.length ? await prisma.expense.findMany({
    where: { groupId: { in: groupIds }, status: "ACTIVE" },
    include: { group: { select: { name: true } }, splits: { where: { userId: user.id } } },
    orderBy: { expenseDate: "asc" },
  }) : [];
  const analytics = buildDashboardAnalytics(expenses.map((expense) => ({
    groupId: expense.groupId,
    groupName: expense.group.name,
    currency: expense.currency,
    expenseDate: expense.expenseDate,
    amountMinor: expense.amountMinor,
    personalShareMinor: expense.splits.reduce((sum, split) => sum + split.amountMinor, 0n),
  })));
  const chartSeries = analytics.currencies.map(({ currency }) => ({
    currency,
    points: analytics.months.filter((month) => month.currency === currency).slice(-12).map((month) => ({
      label: new Date(`${month.month}-01T00:00:00.000Z`).toLocaleDateString("en-MY", { month: "short", year: "2-digit", timeZone: "UTC" }),
      groupSpend: toChartMajorUnits(month.totalSpendMinor),
      personalShare: toChartMajorUnits(month.personalShareMinor),
    })),
  }));

  return (
    <div className="space-y-10">
      <div><p className="text-sm font-medium text-emerald-700">Dashboard</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Your FairShare overview</h1><p className="mt-2 text-muted-foreground">Spending is calculated from active expenses and kept separate by currency.</p></div>
      {analytics.currencies.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{analytics.currencies.map((total) => <Card key={total.currency}><CardHeader className="pb-2"><CardDescription>{total.currency} personal share</CardDescription><CardTitle className="text-2xl tabular-nums">{total.currency} {formatMinorUnits(total.personalShareMinor)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{total.expenseCount} expense{total.expenseCount === 1 ? "" : "s"} · group spend {total.currency} {formatMinorUnits(total.totalSpendMinor)}</CardContent></Card>)}</div> : null}
      <Card><CardHeader><CardTitle>Spending trends</CardTitle><CardDescription>Monthly group totals compared with your personal shares. Chart numbers are display-only; stored calculations remain integer minor units.</CardDescription></CardHeader><CardContent><SpendingCharts series={chartSeries} /></CardContent></Card>
      {analytics.groups.length ? <Card><CardHeader><CardTitle>Your share by group</CardTitle><CardDescription>Ranked within each group’s native currency.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{analytics.groups.map((group) => <Link href={`/groups/${group.groupId}`} key={group.groupId} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted"><div><p className="font-medium">{group.groupName}</p><p className="text-xs text-muted-foreground">{group.expenseCount} expense{group.expenseCount === 1 ? "" : "s"}</p></div><span className="font-semibold tabular-nums">{group.currency} {formatMinorUnits(group.personalShareMinor)}</span></Link>)}</CardContent></Card> : null}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="groups-heading"><h2 id="groups-heading" className="mb-4 text-xl font-semibold">Your groups</h2>
          {memberships.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {memberships.map(({ group, role }) => (
                <Link key={group.id} href={`/groups/${group.id}`} className="group rounded-xl border bg-card p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3"><h2 className="font-semibold group-hover:text-emerald-800">{group.name}</h2><Badge variant={group.status === "ARCHIVED" ? "secondary" : "outline"}>{group.status === "ARCHIVED" ? "Archived" : role === "OWNER" ? "Owner" : "Member"}</Badge></div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">{group.description || "No description"}</p>
                  <p className="mt-4 text-xs text-muted-foreground">{group.currency} · {group.timeZone}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center"><h2 className="font-semibold">No groups yet</h2><p className="mt-2 text-sm text-muted-foreground">Create your first group or accept an invitation.</p></div>
          )}
        </section>
        <Card><CardHeader><CardTitle>Create a group</CardTitle><CardDescription>Every group starts in MYR and you become its owner.</CardDescription></CardHeader><CardContent><CreateGroupForm /></CardContent></Card>
      </div>
    </div>
  );
}

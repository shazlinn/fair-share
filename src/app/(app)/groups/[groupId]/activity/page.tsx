import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTable } from "@/features/activity/activity-table";
import { requireActiveMembership } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export default async function GroupActivityPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const context = await requireActiveMembership(groupId).catch(() => null);
  if (!context) notFound();
  const activities = await prisma.activityLog.findMany({ where: { groupId }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 250 });
  return <div className="space-y-6"><header><Button variant="link" asChild className="h-auto p-0"><Link href={`/groups/${groupId}`}>← Back to group</Link></Button><h1 className="mt-3 text-3xl font-semibold tracking-tight">{context.group.name} activity</h1><p className="mt-2 text-muted-foreground">The latest 250 significant financial and collaboration actions.</p></header><Card><CardHeader><CardTitle>Activity log</CardTitle><CardDescription>Search by actor, action, or entity and filter by action type.</CardDescription></CardHeader><CardContent><ActivityTable rows={activities.map((activity) => ({ id: activity.id, actor: activity.actor?.name || activity.actor?.email || "System", action: activity.action, entityType: activity.entityType, occurredAt: activity.createdAt.toLocaleString("en-MY"), timestamp: activity.createdAt.getTime() }))} /></CardContent></Card></div>;
}

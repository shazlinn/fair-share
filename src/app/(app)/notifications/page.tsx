import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from "@/features/notifications/notification-controls";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

function notificationPath(data: unknown, groupId: string | null) {
  if (data && typeof data === "object" && "expenseId" in data && typeof data.expenseId === "string" && groupId) {
    return `/groups/${groupId}/expenses/${data.expenseId}`;
  }
  return groupId ? `/groups/${groupId}` : "/dashboard";
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((notification) => !notification.readAt).length;
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-sm font-medium text-emerald-700">Inbox</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Notifications</h1><p className="mt-2 text-muted-foreground">Financial and collaboration updates from your groups.</p></div>{unread ? <MarkAllNotificationsReadButton /> : null}</header><Card><CardHeader><CardTitle>Recent updates</CardTitle><CardDescription>{unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You are all caught up."}</CardDescription></CardHeader><CardContent>{notifications.length ? <div className="space-y-3">{notifications.map((notification) => <div key={notification.id} className={`flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${notification.readAt ? "bg-background" : "border-emerald-200 bg-emerald-50/50"}`}><div><div className="flex items-center gap-2"><p className="font-medium">{notification.title}</p>{!notification.readAt ? <Badge>New</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{notification.body}</p><time className="mt-2 block text-xs text-muted-foreground">{notification.createdAt.toLocaleString("en-MY")}</time></div><div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link href={notificationPath(notification.data, notification.groupId)}>View</Link></Button>{!notification.readAt ? <MarkNotificationReadButton notificationId={notification.id} /> : null}</div></div>)}</div> : <div className="rounded-lg border border-dashed p-8 text-center"><p className="font-medium">No notifications yet</p><p className="mt-1 text-sm text-muted-foreground">Updates will appear when group members add expenses, comments, receipts, or repayments.</p></div>}</CardContent></Card></div>;
}

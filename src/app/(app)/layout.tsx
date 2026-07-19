import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/server/db/prisma";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const unreadNotifications = session.user.id
    ? await prisma.notification.count({ where: { userId: session.user.id, readAt: null } })
    : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader name={session.user.name} unreadNotifications={unreadNotifications} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

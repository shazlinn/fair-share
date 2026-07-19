import Link from "next/link";

import { signOutUser } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ name, unreadNotifications }: { name: string | null | undefined; unreadNotifications: number }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-emerald-800">
          FairShare
        </Link>
        <nav className="flex items-center gap-2" aria-label="Primary navigation">
          <span className="hidden text-sm text-muted-foreground sm:inline">{name ?? "Account"}</span>
          <Button asChild variant="ghost" size="sm">
            <Link href="/notifications">Notifications{unreadNotifications ? ` (${unreadNotifications > 99 ? "99+" : unreadNotifications})` : ""}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/profile">Profile</Link>
          </Button>
          <form action={signOutUser}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}

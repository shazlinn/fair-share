"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";

export function MarkNotificationReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return <Button size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(async () => {
    const result = await markNotificationRead({ notificationId });
    if (result.ok) router.refresh();
  })}>{isPending ? "Marking…" : "Mark read"}</Button>;
}

export function MarkAllNotificationsReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return <Button variant="outline" disabled={isPending} onClick={() => startTransition(async () => {
    const result = await markAllNotificationsRead();
    if (result.ok) router.refresh();
  })}>{isPending ? "Marking…" : "Mark all read"}</Button>;
}

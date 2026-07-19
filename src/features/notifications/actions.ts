"use server";

import { markNotificationReadSchema } from "@/features/notifications/schemas";
import type { ActionResult } from "@/lib/action-result";
import { getSafeErrorMessage } from "@/lib/errors";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export async function markNotificationRead(input: unknown): Promise<ActionResult> {
  const parsed = markNotificationReadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid notification request" };
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { id: parsed.data.notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

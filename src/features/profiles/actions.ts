"use server";

import { updateProfileSchema } from "@/features/profiles/schemas";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile details" };
  }

  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, image: parsed.data.image || null },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to update your profile" };
  }
}

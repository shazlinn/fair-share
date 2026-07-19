"use server";

import {
  createGroupSchema,
  groupStatusChangeSchema,
  removeMemberSchema,
} from "@/features/groups/schemas";
import type { ActionResult } from "@/lib/action-result";
import { ApplicationError, getSafeErrorMessage } from "@/lib/errors";
import { requireUser } from "@/server/auth/guards";
import { runSerializable } from "@/server/db/transaction";

export async function createGroup(input: unknown): Promise<ActionResult<{ groupId: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid group details" };
  }

  try {
    const user = await requireUser();
    const group = await runSerializable(async (transaction) => {
      const created = await transaction.group.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          currency: parsed.data.currency,
          timeZone: parsed.data.timeZone,
          createdById: user.id,
        },
      });
      await transaction.groupMember.create({
        data: {
          groupId: created.id,
          userId: user.id,
          role: "OWNER",
        },
      });
      await transaction.activityLog.create({
        data: {
          groupId: created.id,
          actorId: user.id,
          action: "GROUP_CREATED",
          entityType: "Group",
          entityId: created.id,
          metadata: { name: created.name, currency: created.currency },
        },
      });
      return created;
    });
    return { ok: true, data: { groupId: group.id } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function changeGroupArchivedStatus(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = groupStatusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid group status request" };

  try {
    const user = await requireUser();
    const version = await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true },
      });
      if (!membership || membership.leftAt || membership.role !== "OWNER") {
        throw new ApplicationError("NOT_FOUND", "Group not found");
      }

      const desiredStatus = parsed.data.archived ? "ARCHIVED" : "ACTIVE";
      if (membership.group.status === desiredStatus) return membership.group.version;

      const updated = await transaction.group.updateMany({
        where: {
          id: parsed.data.groupId,
          version: parsed.data.expectedVersion,
          status: parsed.data.archived ? "ACTIVE" : "ARCHIVED",
        },
        data: {
          status: desiredStatus,
          archivedAt: parsed.data.archived ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ApplicationError("CONFLICT", "The group changed. Refresh and try again.");
      }

      const nextVersion = parsed.data.expectedVersion + 1;
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: parsed.data.archived ? "GROUP_ARCHIVED" : "GROUP_RESTORED",
          entityType: "Group",
          entityId: parsed.data.groupId,
          metadata: { version: nextVersion },
        },
      });
      return nextVersion;
    });
    return { ok: true, data: { version } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function removeGroupMember(input: unknown): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid member removal request" };

  try {
    const user = await requireUser();
    await runSerializable(async (transaction) => {
      const ownerMembership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true },
      });
      if (!ownerMembership || ownerMembership.leftAt || ownerMembership.role !== "OWNER") {
        throw new ApplicationError("NOT_FOUND", "Group not found");
      }
      if (ownerMembership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }
      if (parsed.data.memberUserId === user.id) {
        throw new ApplicationError("FORBIDDEN", "The group owner cannot remove themselves");
      }

      const removed = await transaction.groupMember.updateMany({
        where: {
          groupId: parsed.data.groupId,
          userId: parsed.data.memberUserId,
          role: "MEMBER",
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });
      if (removed.count !== 1) {
        throw new ApplicationError("NOT_FOUND", "Active member not found");
      }
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "MEMBER_REMOVED",
          entityType: "GroupMember",
          entityId: parsed.data.memberUserId,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

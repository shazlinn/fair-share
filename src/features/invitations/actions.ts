"use server";

import { createHash, randomBytes } from "node:crypto";

import {
  createInvitationSchema,
  invitationTokenSchema,
  revokeInvitationSchema,
} from "@/features/invitations/schemas";
import type { ActionResult } from "@/lib/action-result";
import { ApplicationError, getSafeErrorMessage } from "@/lib/errors";
import { requireUser } from "@/server/auth/guards";
import { runSerializable } from "@/server/db/transaction";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvitation(
  input: unknown,
): Promise<ActionResult<{ invitePath: string; expiresAt: string }>> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid invitation settings" };

  try {
    const user = await requireUser();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000);

    await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true },
      });
      if (!membership || membership.leftAt || membership.role !== "OWNER") {
        throw new ApplicationError("NOT_FOUND", "Group not found");
      }
      if (membership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }

      const invitation = await transaction.groupInvitation.create({
        data: {
          groupId: parsed.data.groupId,
          tokenHash,
          role: "MEMBER",
          createdById: user.id,
          expiresAt,
          maxUses: parsed.data.maxUses,
        },
      });
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "INVITE_CREATED",
          entityType: "GroupInvitation",
          entityId: invitation.id,
          metadata: { maxUses: parsed.data.maxUses, expiresAt: expiresAt.toISOString() },
        },
      });
    });

    return {
      ok: true,
      data: { invitePath: `/invites/${token}`, expiresAt: expiresAt.toISOString() },
    };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function acceptInvitation(tokenInput: unknown): Promise<ActionResult<{ groupId: string }>> {
  const parsed = invitationTokenSchema.safeParse(tokenInput);
  if (!parsed.success) return { ok: false, error: "Invitation link is invalid" };

  try {
    const user = await requireUser();
    const tokenHash = hashToken(parsed.data);
    const groupId = await runSerializable(async (transaction) => {
      const invitation = await transaction.groupInvitation.findUnique({
        where: { tokenHash },
        include: { group: true },
      });
      if (!invitation) throw new ApplicationError("NOT_FOUND", "Invitation link is invalid");
      if (invitation.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "This group is archived");
      }

      const existingMembership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: invitation.groupId, userId: user.id } },
      });
      if (existingMembership && !existingMembership.leftAt) return invitation.groupId;

      const priorRedemption = await transaction.groupInvitationRedemption.findUnique({
        where: { invitationId_userId: { invitationId: invitation.id, userId: user.id } },
      });
      if (priorRedemption) {
        throw new ApplicationError("CONFLICT", "This invitation has already been used");
      }

      const now = new Date();
      const claimed = await transaction.groupInvitation.updateMany({
        where: {
          id: invitation.id,
          revokedAt: null,
          expiresAt: { gt: now },
          useCount: { lt: invitation.maxUses },
        },
        data: { useCount: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        throw new ApplicationError("CONFLICT", "Invitation is expired, revoked, or fully used");
      }

      await transaction.groupMember.upsert({
        where: { groupId_userId: { groupId: invitation.groupId, userId: user.id } },
        create: { groupId: invitation.groupId, userId: user.id, role: "MEMBER" },
        update: { role: "MEMBER", leftAt: null, joinedAt: now },
      });
      await transaction.groupInvitationRedemption.create({
        data: { invitationId: invitation.id, userId: user.id, acceptedAt: now },
      });
      await transaction.activityLog.create({
        data: {
          groupId: invitation.groupId,
          actorId: user.id,
          action: "MEMBER_JOINED",
          entityType: "GroupMember",
          entityId: user.id,
          metadata: { invitationId: invitation.id },
        },
      });
      return invitation.groupId;
    });
    return { ok: true, data: { groupId } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function revokeInvitation(input: unknown): Promise<ActionResult> {
  const parsed = revokeInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid invitation request" };

  try {
    const user = await requireUser();
    await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true },
      });
      if (!membership || membership.leftAt || membership.role !== "OWNER") {
        throw new ApplicationError("NOT_FOUND", "Group not found");
      }
      if (membership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }

      const revoked = await transaction.groupInvitation.updateMany({
        where: {
          id: parsed.data.invitationId,
          groupId: parsed.data.groupId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        throw new ApplicationError("NOT_FOUND", "Active invitation not found");
      }
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "INVITE_REVOKED",
          entityType: "GroupInvitation",
          entityId: parsed.data.invitationId,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

import { auth } from "@/auth";
import { ApplicationError } from "@/lib/errors";
import { prisma } from "@/server/db/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApplicationError("UNAUTHENTICATED", "You must sign in to continue");
  }
  return session.user;
}

export async function requireActiveMembership(groupId: string) {
  const user = await requireUser();
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId: user.id,
      leftAt: null,
    },
    include: { group: true },
  });
  if (!membership) {
    throw new ApplicationError("NOT_FOUND", "Group not found");
  }
  return { user, membership, group: membership.group };
}

export async function requireOwner(groupId: string) {
  const context = await requireActiveMembership(groupId);
  if (context.membership.role !== "OWNER") {
    throw new ApplicationError("FORBIDDEN", "Only the group owner can perform this action");
  }
  return context;
}

export async function requireWritableGroup(groupId: string) {
  const context = await requireActiveMembership(groupId);
  if (context.group.status === "ARCHIVED") {
    throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
  }
  return context;
}

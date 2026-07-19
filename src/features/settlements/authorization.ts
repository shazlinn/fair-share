import type { GroupRole } from "@/generated/prisma/enums";

export function canRecordSettlement(
  actorId: string,
  role: GroupRole,
  fromUserId: string,
  toUserId: string,
) {
  return role === "OWNER" || actorId === fromUserId || actorId === toUserId;
}

export function canVoidSettlement(actorId: string, role: GroupRole, createdById: string) {
  return role === "OWNER" || actorId === createdById;
}

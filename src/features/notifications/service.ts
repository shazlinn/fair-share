import { Prisma, type NotificationType } from "@/generated/prisma/client";
import type { TransactionClient } from "@/server/db/transaction";

export async function notifyActiveGroupMembers(
  transaction: TransactionClient,
  input: {
    groupId: string;
    actorId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Prisma.InputJsonValue;
  },
) {
  const recipients = await transaction.groupMember.findMany({
    where: { groupId: input.groupId, leftAt: null, userId: { not: input.actorId } },
    select: { userId: true },
  });
  if (!recipients.length) return;

  await transaction.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      groupId: input.groupId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? Prisma.JsonNull,
    })),
  });
}

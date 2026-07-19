"use server";

import { createHash, randomUUID } from "node:crypto";

import { notifyActiveGroupMembers } from "@/features/notifications/service";
import { deleteReceiptSchema, receiptContextSchema } from "@/features/receipts/schemas";
import { ReceiptValidationError, validateReceiptBytes } from "@/features/receipts/validate-file";
import type { ActionResult } from "@/lib/action-result";
import { ApplicationError, getSafeErrorMessage } from "@/lib/errors";
import { requireUser } from "@/server/auth/guards";
import { runSerializable } from "@/server/db/transaction";

export async function uploadReceipt(formData: FormData): Promise<ActionResult<{ attachmentId: string }>> {
  const parsed = receiptContextSchema.safeParse({
    groupId: formData.get("groupId"),
    expenseId: formData.get("expenseId"),
  });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File)) {
    return { ok: false, error: "Invalid receipt upload" };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      validateReceiptBytes(file.type, bytes);
    } catch (error) {
      if (error instanceof ReceiptValidationError) {
        throw new ApplicationError("VALIDATION_ERROR", error.message);
      }
      throw error;
    }
    const user = await requireUser();
    const safeFileName = (file.name.split(/[\\/]/).pop() || "receipt").slice(0, 255);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const attachmentId = await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true, user: { select: { name: true, email: true } } },
      });
      if (!membership || membership.leftAt) throw new ApplicationError("NOT_FOUND", "Expense not found");
      if (membership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }
      const expense = await transaction.expense.findFirst({
        where: { id: parsed.data.expenseId, groupId: parsed.data.groupId, status: "ACTIVE" },
        select: { id: true, description: true },
      });
      if (!expense) throw new ApplicationError("NOT_FOUND", "Expense not found");

      const attachment = await transaction.receiptAttachment.create({
        data: {
          groupId: parsed.data.groupId,
          expenseId: expense.id,
          uploadedById: user.id,
          storageKey: randomUUID(),
          fileName: safeFileName,
          contentType: file.type,
          sizeBytes: bytes.length,
          checksum,
          data: bytes,
          status: "READY",
        },
      });
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "RECEIPT_ATTACHED",
          entityType: "ReceiptAttachment",
          entityId: attachment.id,
          metadata: { expenseId: expense.id, fileName: safeFileName, sizeBytes: bytes.length },
        },
      });
      await notifyActiveGroupMembers(transaction, {
        groupId: parsed.data.groupId,
        actorId: user.id,
        type: "RECEIPT_ATTACHED",
        title: `Receipt attached to ${expense.description}`,
        body: `${membership.user.name || membership.user.email || "A member"} attached ${safeFileName}`,
        data: { expenseId: expense.id, attachmentId: attachment.id },
      });
      return attachment.id;
    });
    return { ok: true, data: { attachmentId } };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

export async function deleteReceipt(input: unknown): Promise<ActionResult> {
  const parsed = deleteReceiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid receipt deletion request" };
  try {
    const user = await requireUser();
    await runSerializable(async (transaction) => {
      const membership = await transaction.groupMember.findUnique({
        where: { groupId_userId: { groupId: parsed.data.groupId, userId: user.id } },
        include: { group: true },
      });
      if (!membership || membership.leftAt) throw new ApplicationError("NOT_FOUND", "Receipt not found");
      if (membership.group.status === "ARCHIVED") {
        throw new ApplicationError("FORBIDDEN", "Archived groups are read-only");
      }
      const attachment = await transaction.receiptAttachment.findFirst({
        where: {
          id: parsed.data.attachmentId,
          groupId: parsed.data.groupId,
          expenseId: parsed.data.expenseId,
          status: "READY",
        },
      });
      if (!attachment) throw new ApplicationError("NOT_FOUND", "Receipt not found");
      if (attachment.uploadedById !== user.id && membership.role !== "OWNER") {
        throw new ApplicationError("FORBIDDEN", "Only the uploader or group owner can delete it");
      }
      const deleted = await transaction.receiptAttachment.updateMany({
        where: { id: attachment.id, status: "READY" },
        data: { status: "DELETED", data: null, deletedAt: new Date() },
      });
      if (deleted.count !== 1) throw new ApplicationError("CONFLICT", "The receipt changed. Refresh and try again.");
      await transaction.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorId: user.id,
          action: "RECEIPT_DELETED",
          entityType: "ReceiptAttachment",
          entityId: attachment.id,
          metadata: { expenseId: parsed.data.expenseId, fileName: attachment.fileName },
        },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error) };
  }
}

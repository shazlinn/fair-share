import { describe, expect, it } from "vitest";

import { createCommentSchema, deleteCommentSchema } from "@/features/comments/schemas";
import { deleteReceiptSchema, receiptContextSchema } from "@/features/receipts/schemas";

const groupId = "cmgroup001";
const expenseId = "cmexpense001";

describe("collaboration boundary schemas", () => {
  it("trims valid comments", () => {
    const result = createCommentSchema.parse({ groupId, expenseId, body: "  Looks correct  " });
    expect(result.body).toBe("Looks correct");
  });

  it("rejects blank and oversized comments", () => {
    expect(createCommentSchema.safeParse({ groupId, expenseId, body: "   " }).success).toBe(false);
    expect(createCommentSchema.safeParse({ groupId, expenseId, body: "x".repeat(1_001) }).success).toBe(false);
  });

  it("requires scoped identifiers for comment and receipt deletion", () => {
    expect(deleteCommentSchema.safeParse({ groupId, expenseId, commentId: "cmcomment001" }).success).toBe(true);
    expect(receiptContextSchema.safeParse({ groupId, expenseId }).success).toBe(true);
    expect(deleteReceiptSchema.safeParse({ groupId, expenseId, attachmentId: "bad id" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { recordSettlementSchema, voidSettlementSchema } from "@/features/settlements/schemas";

const valid = {
  groupId: "cmgroup001",
  fromUserId: "cmember001",
  toUserId: "cmember002",
  amount: "12.34",
  memo: "Bank transfer",
  settledAt: "2026-07-19",
  idempotencyKey: "019f763a-a41d-7410-b6b2-12b9a3eb71e6",
};

describe("settlement transport schemas", () => {
  it("accepts string money and strict identifiers", () => {
    expect(recordSettlementSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    { ...valid, amount: 12.34 },
    { ...valid, settledAt: "19/07/2026" },
    { ...valid, idempotencyKey: "reused-key" },
    { ...valid, memo: "x".repeat(501) },
  ])("rejects malformed boundary data", (input) => {
    expect(recordSettlementSchema.safeParse(input).success).toBe(false);
  });

  it("requires an optimistic version when voiding", () => {
    expect(voidSettlementSchema.safeParse({
      groupId: valid.groupId,
      settlementId: "cmsettlement001",
      expectedVersion: 1,
    }).success).toBe(true);
    expect(voidSettlementSchema.safeParse({
      groupId: valid.groupId,
      settlementId: "cmsettlement001",
      expectedVersion: 0,
    }).success).toBe(false);
  });
});

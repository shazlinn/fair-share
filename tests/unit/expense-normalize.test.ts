import { describe, expect, it } from "vitest";

import { prepareExpense } from "@/features/expenses/normalize";
import { createExpenseSchema } from "@/features/expenses/schemas";

const groupId = "cmgroup001";
const alice = "cmember001";
const bob = "cmember002";
const chen = "cmember003";

const base = {
  groupId,
  description: "Dinner",
  notes: "",
  amount: "100.00",
  expenseDate: "2026-07-19",
  payers: [{ memberId: alice, amount: "100.00" }],
};

describe("expense input normalization", () => {
  it("allocates an equal split without losing a minor unit", () => {
    const result = prepareExpense({ ...base, split: { method: "EQUAL", participantIds: [alice, bob, chen] } });

    expect(result.amountMinor).toBe(10_000n);
    expect(result.splits.map(({ memberId, amountMinor }) => ({ memberId, amountMinor }))).toEqual([
      { memberId: alice, amountMinor: 3_334n },
      { memberId: bob, amountMinor: 3_333n },
      { memberId: chen, amountMinor: 3_333n },
    ]);
    expect(result.splits.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(10_000n);
  });

  it("preserves exact amounts", () => {
    const result = prepareExpense({
      ...base,
      split: {
        method: "EXACT",
        participants: [
          { memberId: alice, amount: "12.34" },
          { memberId: bob, amount: "87.66" },
        ],
      },
    });
    expect(result.splits.map((item) => item.amountMinor)).toEqual([1_234n, 8_766n]);
  });

  it("stores percentage basis points and deterministically allocates rounding", () => {
    const result = prepareExpense({
      ...base,
      amount: "0.05",
      payers: [{ memberId: bob, amount: "0.05" }],
      split: {
        method: "PERCENTAGE",
        participants: [
          { memberId: alice, percentage: "33.33" },
          { memberId: bob, percentage: "33.33" },
          { memberId: chen, percentage: "33.34" },
        ],
      },
    });
    expect(result.splits.map((item) => item.percentageBasisPoints)).toEqual([3_333, 3_333, 3_334]);
    expect(result.splits.map((item) => item.amountMinor)).toEqual([2n, 1n, 2n]);
  });

  it("stores share weights and permits zero-share participants", () => {
    const result = prepareExpense({
      ...base,
      split: {
        method: "SHARES",
        participants: [
          { memberId: alice, shares: "1" },
          { memberId: bob, shares: "2" },
          { memberId: chen, shares: "0" },
        ],
      },
    });
    expect(result.splits.map((item) => item.shareUnits)).toEqual([1n, 2n, 0n]);
    expect(result.splits.map((item) => item.amountMinor)).toEqual([3_333n, 6_667n, 0n]);
  });

  it.each([
    ["a zero total", { ...base, amount: "0", payers: [{ memberId: alice, amount: "0" }], split: { method: "EQUAL" as const, participantIds: [alice] } }, "greater than zero"],
    ["payer totals that do not match", { ...base, payers: [{ memberId: alice, amount: "99.99" }], split: { method: "EQUAL" as const, participantIds: [alice] } }, "must equal"],
    ["duplicate payers", { ...base, payers: [{ memberId: alice, amount: "50.00" }, { memberId: alice, amount: "50.00" }], split: { method: "EQUAL" as const, participantIds: [alice] } }, "unique"],
    ["an invalid calendar date", { ...base, expenseDate: "2026-02-30", split: { method: "EQUAL" as const, participantIds: [alice] } }, "date is invalid"],
    ["percentage totals below 100", { ...base, split: { method: "PERCENTAGE" as const, participants: [{ memberId: alice, percentage: "99.99" }] } }, "10,000 basis points"],
    ["percentage precision beyond basis points", { ...base, split: { method: "PERCENTAGE" as const, participants: [{ memberId: alice, percentage: "100.000" }] } }, "two decimal places"],
    ["all-zero shares", { ...base, split: { method: "SHARES" as const, participants: [{ memberId: alice, shares: "0" }] } }, "positive weight"],
  ])("rejects %s", (_label, input, message) => {
    expect(() => prepareExpense(input)).toThrow(message);
  });
});

describe("expense transport validation", () => {
  it("accepts decimal strings and an idempotency UUID", () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      idempotencyKey: "019f763a-a41d-7410-b6b2-12b9a3eb71e6",
      split: { method: "EQUAL", participantIds: [alice, bob] },
    });
    expect(result.success).toBe(true);
  });

  it("does not accept numeric money values across the server boundary", () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      amount: 100,
      idempotencyKey: "019f763a-a41d-7410-b6b2-12b9a3eb71e6",
      split: { method: "EQUAL", participantIds: [alice] },
    });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  SettlementValidationError,
  validateSettlement,
} from "@/domain/settlements/validate-settlement";

const balances = [
  { memberId: "debtor", netMinor: -5_000n },
  { memberId: "creditor", netMinor: 4_000n },
  { memberId: "creditor-two", netMinor: 1_000n },
  { memberId: "settled", netMinor: 0n },
];

describe("settlement validation", () => {
  it("accepts an amount within both parties' outstanding balances", () => {
    const settlement = {
      fromMemberId: "debtor",
      toMemberId: "creditor",
      amountMinor: 4_000n,
    };
    expect(validateSettlement(balances, settlement)).toEqual(settlement);
  });

  it.each([
    {
      fromMemberId: "debtor",
      toMemberId: "creditor",
      amountMinor: 4_001n,
      reason: "over-settlement",
    },
    {
      fromMemberId: "creditor",
      toMemberId: "debtor",
      amountMinor: 1n,
      reason: "wrong direction",
    },
    {
      fromMemberId: "settled",
      toMemberId: "creditor",
      amountMinor: 1n,
      reason: "settled sender",
    },
    {
      fromMemberId: "debtor",
      toMemberId: "settled",
      amountMinor: 1n,
      reason: "settled receiver",
    },
    {
      fromMemberId: "debtor",
      toMemberId: "outsider",
      amountMinor: 1n,
      reason: "unknown member",
    },
    {
      fromMemberId: "debtor",
      toMemberId: "debtor",
      amountMinor: 1n,
      reason: "self settlement",
    },
    {
      fromMemberId: "debtor",
      toMemberId: "creditor",
      amountMinor: 0n,
      reason: "zero amount",
    },
  ])("rejects $reason", (settlement) => {
    expect(() => validateSettlement(balances, settlement)).toThrow(SettlementValidationError);
  });

  it("rejects duplicate balance entries", () => {
    expect(() =>
      validateSettlement(
        [
          { memberId: "a", netMinor: -1n },
          { memberId: "a", netMinor: 1n },
        ],
        { fromMemberId: "a", toMemberId: "b", amountMinor: 1n },
      ),
    ).toThrow(SettlementValidationError);
  });
});

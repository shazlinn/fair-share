import { describe, expect, it } from "vitest";

import {
  BalanceCalculationError,
  calculateBalances,
} from "@/domain/balances/calculate-balances";

describe("group balance calculation", () => {
  it("calculates paid minus share plus sent minus received", () => {
    expect(
      calculateBalances({
        memberIds: ["charlie", "alice", "bob"],
        payments: [{ memberId: "alice", amountMinor: 10_000n }],
        shares: [
          { memberId: "alice", amountMinor: 3_334n },
          { memberId: "bob", amountMinor: 3_333n },
          { memberId: "charlie", amountMinor: 3_333n },
        ],
        settlements: [
          { fromMemberId: "bob", toMemberId: "alice", amountMinor: 2_000n },
        ],
      }),
    ).toEqual([
      {
        memberId: "alice",
        paidMinor: 10_000n,
        shareMinor: 3_334n,
        sentMinor: 0n,
        receivedMinor: 2_000n,
        netMinor: 4_666n,
      },
      {
        memberId: "bob",
        paidMinor: 0n,
        shareMinor: 3_333n,
        sentMinor: 2_000n,
        receivedMinor: 0n,
        netMinor: -1_333n,
      },
      {
        memberId: "charlie",
        paidMinor: 0n,
        shareMinor: 3_333n,
        sentMinor: 0n,
        receivedMinor: 0n,
        netMinor: -3_333n,
      },
    ]);
  });

  it("aggregates multiple expenses, payers, and settlements", () => {
    const balances = calculateBalances({
      memberIds: ["a", "b"],
      payments: [
        { memberId: "a", amountMinor: 600n },
        { memberId: "b", amountMinor: 400n },
        { memberId: "b", amountMinor: 500n },
      ],
      shares: [
        { memberId: "a", amountMinor: 500n },
        { memberId: "b", amountMinor: 500n },
        { memberId: "a", amountMinor: 250n },
        { memberId: "b", amountMinor: 250n },
      ],
      settlements: [{ fromMemberId: "a", toMemberId: "b", amountMinor: 150n }],
    });

    expect(balances.map(({ memberId, netMinor }) => ({ memberId, netMinor }))).toEqual([
      { memberId: "a", netMinor: 0n },
      { memberId: "b", netMinor: 0n },
    ]);
  });

  it("keeps members with no activity at zero", () => {
    expect(
      calculateBalances({
        memberIds: ["a"],
        payments: [],
        shares: [],
        settlements: [],
      })[0]?.netMinor,
    ).toBe(0n);
  });

  it("rejects corrupt payment and share totals", () => {
    expect(() =>
      calculateBalances({
        memberIds: ["a"],
        payments: [{ memberId: "a", amountMinor: 100n }],
        shares: [{ memberId: "a", amountMinor: 99n }],
        settlements: [],
      }),
    ).toThrow("Total payments must equal total personal shares");
  });

  it("rejects duplicate members and non-positive settlement facts", () => {
    expect(() =>
      calculateBalances({
        memberIds: ["a", "a"],
        payments: [],
        shares: [],
        settlements: [],
      }),
    ).toThrow(BalanceCalculationError);
    expect(() =>
      calculateBalances({
        memberIds: ["a", "b"],
        payments: [],
        shares: [],
        settlements: [{ fromMemberId: "a", toMemberId: "b", amountMinor: 0n }],
      }),
    ).toThrow(BalanceCalculationError);
  });

  it.each([
    {
      name: "unknown participant",
      payments: [{ memberId: "outsider", amountMinor: 100n }],
      shares: [{ memberId: "a", amountMinor: 100n }],
      settlements: [],
    },
    {
      name: "non-positive payment",
      payments: [{ memberId: "a", amountMinor: 0n }],
      shares: [],
      settlements: [],
    },
    {
      name: "negative share",
      payments: [],
      shares: [{ memberId: "a", amountMinor: -1n }],
      settlements: [],
    },
    {
      name: "self settlement",
      payments: [],
      shares: [],
      settlements: [{ fromMemberId: "a", toMemberId: "a", amountMinor: 1n }],
    },
  ])("rejects $name", ({ payments, shares, settlements }) => {
    expect(() =>
      calculateBalances({ memberIds: ["a"], payments, shares, settlements }),
    ).toThrow(BalanceCalculationError);
  });
});

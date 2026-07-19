import { describe, expect, it } from "vitest";

import {
  DebtSimplificationError,
  simplifyDebts,
  type NetBalance,
} from "@/domain/balances/simplify-debts";

function replayTransfers(balances: readonly NetBalance[]) {
  const replayed = new Map(balances.map(({ memberId, netMinor }) => [memberId, netMinor]));
  const transfers = simplifyDebts(balances);

  for (const transfer of transfers) {
    replayed.set(
      transfer.fromMemberId,
      (replayed.get(transfer.fromMemberId) ?? 0n) + transfer.amountMinor,
    );
    replayed.set(
      transfer.toMemberId,
      (replayed.get(transfer.toMemberId) ?? 0n) - transfer.amountMinor,
    );
  }

  return { replayed, transfers };
}

describe("debt simplification", () => {
  it("matches debtors and creditors while preserving exact balances", () => {
    const { replayed, transfers } = replayTransfers([
      { memberId: "a", netMinor: 6_000n },
      { memberId: "b", netMinor: 4_000n },
      { memberId: "c", netMinor: -7_000n },
      { memberId: "d", netMinor: -3_000n },
    ]);

    expect(transfers).toEqual([
      { fromMemberId: "c", toMemberId: "a", amountMinor: 6_000n },
      { fromMemberId: "c", toMemberId: "b", amountMinor: 1_000n },
      { fromMemberId: "d", toMemberId: "b", amountMinor: 3_000n },
    ]);
    expect([...replayed.values()].every((balance) => balance === 0n)).toBe(true);
  });

  it("uses member ID as the deterministic tie-break", () => {
    const balances = [
      { memberId: "credit-b", netMinor: 100n },
      { memberId: "debt-b", netMinor: -100n },
      { memberId: "credit-a", netMinor: 100n },
      { memberId: "debt-a", netMinor: -100n },
    ];

    expect(simplifyDebts(balances)).toEqual([
      { fromMemberId: "debt-a", toMemberId: "credit-a", amountMinor: 100n },
      { fromMemberId: "debt-b", toMemberId: "credit-b", amountMinor: 100n },
    ]);
    expect(simplifyDebts([...balances].reverse())).toEqual(simplifyDebts(balances));
  });

  it("returns no transfers for an already settled group", () => {
    expect(simplifyDebts([{ memberId: "a", netMinor: 0n }])).toEqual([]);
    expect(simplifyDebts([])).toEqual([]);
  });

  it("rejects unbalanced or duplicate input", () => {
    expect(() => simplifyDebts([{ memberId: "a", netMinor: 1n }])).toThrow(
      DebtSimplificationError,
    );
    expect(() =>
      simplifyDebts([
        { memberId: "a", netMinor: 1n },
        { memberId: "a", netMinor: -1n },
      ]),
    ).toThrow(DebtSimplificationError);
  });
});

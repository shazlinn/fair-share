import { describe, expect, it } from "vitest";

import { simplifyDebts, type NetBalance } from "@/domain/balances/simplify-debts";
import { allocateByWeight } from "@/domain/money/allocate";
import { formatMinorUnits, parseMinorUnits } from "@/domain/money/minor-units";

function createRandom(seed = 0x5eed1234) {
  let state = seed >>> 0;
  return (maximumExclusive: number) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % maximumExclusive;
  };
}

describe("financial conservation properties", () => {
  it("preserves totals across 1,000 randomized weighted allocations", () => {
    const random = createRandom();

    for (let example = 0; example < 1_000; example += 1) {
      const participantCount = random(20) + 1;
      const totalMinor = BigInt(random(1_000_001));
      const participants = Array.from({ length: participantCount }, (_, index) => ({
        memberId: `member-${index.toString().padStart(2, "0")}`,
        weight: BigInt(random(100)),
      }));
      const first = participants[0];
      if (!first) throw new Error("Random allocation must have a participant");
      first.weight = first.weight + 1n;

      const allocation = allocateByWeight(totalMinor, participants);
      expect(allocation.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(totalMinor);
      expect(allocateByWeight(totalMinor, [...participants].reverse())).toEqual(allocation);
      expect(allocation.every((item) => item.amountMinor >= 0n)).toBe(true);
    }
  });

  it("settles 1,000 randomized zero-sum groups exactly", () => {
    const random = createRandom(0xc0ffee);

    for (let example = 0; example < 1_000; example += 1) {
      const memberCount = random(15) + 2;
      const balances: NetBalance[] = [];
      let subtotal = 0n;

      for (let index = 0; index < memberCount - 1; index += 1) {
        const netMinor = BigInt(random(200_001) - 100_000);
        balances.push({ memberId: `member-${index.toString().padStart(2, "0")}`, netMinor });
        subtotal += netMinor;
      }
      balances.push({
        memberId: `member-${(memberCount - 1).toString().padStart(2, "0")}`,
        netMinor: -subtotal,
      });

      const replayed = new Map(balances.map(({ memberId, netMinor }) => [memberId, netMinor]));
      const transfers = simplifyDebts(balances);
      const debtorCount = balances.filter(({ netMinor }) => netMinor < 0n).length;
      const creditorCount = balances.filter(({ netMinor }) => netMinor > 0n).length;
      const maximumTransfers = debtorCount + creditorCount - 1;

      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, maximumTransfers));
      for (const transfer of transfers) {
        expect(transfer.amountMinor).toBeGreaterThan(0n);
        replayed.set(
          transfer.fromMemberId,
          (replayed.get(transfer.fromMemberId) ?? 0n) + transfer.amountMinor,
        );
        replayed.set(
          transfer.toMemberId,
          (replayed.get(transfer.toMemberId) ?? 0n) - transfer.amountMinor,
        );
      }
      expect([...replayed.values()].every((balance) => balance === 0n)).toBe(true);
    }
  });

  it("round-trips 1,000 randomized minor-unit values as decimal strings", () => {
    const random = createRandom(12345);

    for (let example = 0; example < 1_000; example += 1) {
      const amountMinor = BigInt(random(1_000_000_000));
      expect(parseMinorUnits(formatMinorUnits(amountMinor))).toBe(amountMinor);
    }
  });
});

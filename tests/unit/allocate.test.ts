import { describe, expect, it } from "vitest";

import {
  allocateByPercentage,
  allocateByWeight,
  allocateEqually,
  AllocationError,
  validateExactAllocation,
} from "@/domain/money/allocate";

describe("expense allocation", () => {
  it("allocates RM100 equally and preserves every sen", () => {
    const result = allocateEqually(10_000n, ["c", "a", "b"]);

    expect(result).toEqual([
      { memberId: "a", amountMinor: 3_334n },
      { memberId: "b", amountMinor: 3_333n },
      { memberId: "c", amountMinor: 3_333n },
    ]);
    expect(result.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(10_000n);
  });

  it("is deterministic regardless of input ordering", () => {
    const first = allocateEqually(2n, ["c", "a", "b"]);
    const second = allocateEqually(2n, ["b", "c", "a"]);
    expect(first).toEqual(second);
  });

  it("allocates weighted shares using largest remainders", () => {
    expect(
      allocateByWeight(10n, [
        { memberId: "a", weight: 1n },
        { memberId: "b", weight: 2n },
      ]),
    ).toEqual([
      { memberId: "a", amountMinor: 3n },
      { memberId: "b", amountMinor: 7n },
    ]);
  });

  it("requires percentages to total exactly 100 percent", () => {
    expect(() =>
      allocateByPercentage(1_000n, [
        { memberId: "a", basisPoints: 5_000 },
        { memberId: "b", basisPoints: 4_999 },
      ]),
    ).toThrow(AllocationError);
  });

  it("allocates valid percentages exactly", () => {
    expect(
      allocateByPercentage(999n, [
        { memberId: "a", basisPoints: 2_500 },
        { memberId: "b", basisPoints: 7_500 },
      ]),
    ).toEqual([
      { memberId: "a", amountMinor: 250n },
      { memberId: "b", amountMinor: 749n },
    ]);
  });

  it("validates exact allocations", () => {
    expect(() =>
      validateExactAllocation(1_000n, [
        { memberId: "a", amountMinor: 400n },
        { memberId: "b", amountMinor: 599n },
      ]),
    ).toThrow(AllocationError);
  });

  it("returns a sorted valid exact allocation", () => {
    expect(
      validateExactAllocation(1_000n, [
        { memberId: "b", amountMinor: 600n },
        { memberId: "a", amountMinor: 400n },
      ]),
    ).toEqual([
      { memberId: "a", amountMinor: 400n },
      { memberId: "b", amountMinor: 600n },
    ]);
  });

  it("rejects malformed exact allocations", () => {
    expect(() =>
      validateExactAllocation(100n, [
        { memberId: "a", amountMinor: 100n },
        { memberId: "a", amountMinor: 0n },
      ]),
    ).toThrow(AllocationError);
    expect(() =>
      validateExactAllocation(100n, [{ memberId: "a", amountMinor: -1n }]),
    ).toThrow(AllocationError);
  });

  it("rejects invalid participant sets", () => {
    expect(() => allocateByWeight(100n, [])).toThrow(AllocationError);
    expect(() =>
      allocateByWeight(100n, [
        { memberId: "a", weight: 0n },
        { memberId: "b", weight: 0n },
      ]),
    ).toThrow(AllocationError);
    expect(() =>
      allocateByWeight(100n, [
        { memberId: "a", weight: 1n },
        { memberId: "a", weight: 1n },
      ]),
    ).toThrow(AllocationError);
  });
});

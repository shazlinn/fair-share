import { describe, expect, it } from "vitest";

import {
  formatMinorUnits,
  MoneyInputError,
  parseMinorUnits,
  POSTGRES_BIGINT_MAX,
} from "@/domain/money/minor-units";

describe("minor-unit money parsing", () => {
  it.each([
    ["0", 0n],
    ["0.01", 1n],
    ["12.3", 1230n],
    ["100.00", 10_000n],
  ])("parses %s without floating point", (input, expected) => {
    expect(parseMinorUnits(input)).toBe(expected);
  });

  it.each(["-1.00", "+1.00", "1e2", "1,000.00", " 1.00", "01.00", "1.001"])(
    "rejects ambiguous input %s",
    (input) => expect(() => parseMinorUnits(input)).toThrow(MoneyInputError),
  );

  it("rejects values above the PostgreSQL bigint range", () => {
    expect(() => parseMinorUnits("92233720368547758.08")).toThrow(MoneyInputError);
    expect(parseMinorUnits("92233720368547758.07")).toBe(POSTGRES_BIGINT_MAX);
  });

  it("formats signed balances without losing sen", () => {
    expect(formatMinorUnits(-12_345n)).toBe("-123.45");
  });

  it("supports currencies with no fractional minor units", () => {
    expect(parseMinorUnits("123", 0)).toBe(123n);
    expect(formatMinorUnits(123n, 0)).toBe("123");
  });

  it("rejects unsupported currency scales at both boundaries", () => {
    expect(() => parseMinorUnits("1", -1)).toThrow(MoneyInputError);
    expect(() => formatMinorUnits(1n, 7)).toThrow(MoneyInputError);
  });
});

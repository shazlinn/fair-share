export const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

export function parseMinorUnits(input: string, scale = 2): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
    throw new MoneyInputError("Currency scale must be an integer from 0 to 6");
  }

  const pattern = scale === 0
    ? /^(0|[1-9]\d*)$/
    : new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${scale}}))?$`);
  const match = pattern.exec(input);

  if (!match) {
    throw new MoneyInputError("Amount must be a non-negative decimal string");
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(scale, "0");
  const factor = 10n ** BigInt(scale);
  const amount = BigInt(whole) * factor + BigInt(fraction || "0");

  if (amount > POSTGRES_BIGINT_MAX) {
    throw new MoneyInputError("Amount exceeds the supported database range");
  }

  return amount;
}

export function formatMinorUnits(amount: bigint, scale = 2): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
    throw new MoneyInputError("Currency scale must be an integer from 0 to 6");
  }

  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;

  if (scale === 0) {
    return `${sign}${absolute}`;
  }

  const factor = 10n ** BigInt(scale);
  const whole = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(scale, "0");

  return `${sign}${whole}.${fraction}`;
}

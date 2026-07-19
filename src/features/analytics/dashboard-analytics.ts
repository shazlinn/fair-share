export type DashboardExpenseFact = Readonly<{
  groupId: string;
  groupName: string;
  currency: string;
  expenseDate: Date;
  amountMinor: bigint;
  personalShareMinor: bigint;
}>;

export type CurrencyTotal = Readonly<{
  currency: string;
  totalSpendMinor: bigint;
  personalShareMinor: bigint;
  expenseCount: number;
}>;

export type MonthlyTotal = CurrencyTotal & Readonly<{ month: string }>;
export type GroupTotal = CurrencyTotal & Readonly<{ groupId: string; groupName: string }>;

const MAX_SAFE_CHART_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export function toChartMajorUnits(amountMinor: bigint) {
  const bounded = amountMinor > MAX_SAFE_CHART_MINOR ? MAX_SAFE_CHART_MINOR : amountMinor;
  return Number(bounded) / 100;
}

function addFact<T extends CurrencyTotal>(current: T | undefined, base: T, fact: DashboardExpenseFact): T {
  return {
    ...base,
    totalSpendMinor: (current?.totalSpendMinor ?? 0n) + fact.amountMinor,
    personalShareMinor: (current?.personalShareMinor ?? 0n) + fact.personalShareMinor,
    expenseCount: (current?.expenseCount ?? 0) + 1,
  };
}

export function buildDashboardAnalytics(facts: readonly DashboardExpenseFact[]) {
  const currencies = new Map<string, CurrencyTotal>();
  const months = new Map<string, MonthlyTotal>();
  const groups = new Map<string, GroupTotal>();

  for (const fact of facts) {
    const currencyBase = { currency: fact.currency, totalSpendMinor: 0n, personalShareMinor: 0n, expenseCount: 0 };
    currencies.set(fact.currency, addFact(currencies.get(fact.currency), currencyBase, fact));

    const month = fact.expenseDate.toISOString().slice(0, 7);
    const monthKey = `${month}:${fact.currency}`;
    const monthBase = { ...currencyBase, month };
    months.set(monthKey, addFact(months.get(monthKey), monthBase, fact));

    const groupBase = { ...currencyBase, groupId: fact.groupId, groupName: fact.groupName };
    groups.set(fact.groupId, addFact(groups.get(fact.groupId), groupBase, fact));
  }

  return {
    currencies: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency)),
    groups: [...groups.values()].sort((a, b) => {
      if (a.personalShareMinor > b.personalShareMinor) return -1;
      if (a.personalShareMinor < b.personalShareMinor) return 1;
      return a.groupName.localeCompare(b.groupName);
    }),
  };
}

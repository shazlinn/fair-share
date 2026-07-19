import {
  allocateByPercentage,
  allocateByWeight,
  allocateEqually,
  AllocationError,
  validateExactAllocation,
} from "@/domain/money/allocate";
import { parseMinorUnits } from "@/domain/money/minor-units";
import type { ExpenseFieldsInput } from "@/features/expenses/schemas";

export type PreparedExpensePayer = Readonly<{
  memberId: string;
  amountMinor: bigint;
}>;

export type PreparedExpenseSplit = Readonly<{
  memberId: string;
  amountMinor: bigint;
  percentageBasisPoints: number | null;
  shareUnits: bigint | null;
}>;

export type PreparedExpense = Readonly<{
  description: string;
  notes: string | null;
  amountMinor: bigint;
  expenseDate: Date;
  splitMethod: ExpenseFieldsInput["split"]["method"];
  payers: readonly PreparedExpensePayer[];
  splits: readonly PreparedExpenseSplit[];
}>;

export function parsePercentageBasisPoints(input: string) {
  const match = /^(0|[1-9]\d?|100)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) throw new AllocationError("Percentages must use at most two decimal places");

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const basisPoints = whole * 100 + fraction;
  if (basisPoints > 10_000) throw new AllocationError("A percentage cannot exceed 100%");
  return basisPoints;
}

function parseExpenseDate(input: string) {
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new AllocationError("Expense date is invalid");
  }
  return date;
}

export function prepareExpense(input: ExpenseFieldsInput): PreparedExpense {
  const amountMinor = parseMinorUnits(input.amount);
  if (amountMinor <= 0n) throw new AllocationError("Expense amount must be greater than zero");

  const payerIds = new Set<string>();
  const payers = input.payers.map((payer) => {
    if (payerIds.has(payer.memberId)) throw new AllocationError("Payers must be unique");
    payerIds.add(payer.memberId);
    const payerAmount = parseMinorUnits(payer.amount);
    if (payerAmount <= 0n) throw new AllocationError("Payer amounts must be greater than zero");
    return { memberId: payer.memberId, amountMinor: payerAmount };
  });
  if (payers.reduce((sum, payer) => sum + payer.amountMinor, 0n) !== amountMinor) {
    throw new AllocationError("Payer amounts must equal the expense total");
  }

  let splits: PreparedExpenseSplit[];
  switch (input.split.method) {
    case "EQUAL":
      splits = allocateEqually(amountMinor, input.split.participantIds).map((allocation) => ({
        ...allocation,
        percentageBasisPoints: null,
        shareUnits: null,
      }));
      break;
    case "EXACT": {
      const exact = input.split.participants.map((participant) => ({
        memberId: participant.memberId,
        amountMinor: parseMinorUnits(participant.amount),
      }));
      splits = validateExactAllocation(amountMinor, exact).map((allocation) => ({
        ...allocation,
        percentageBasisPoints: null,
        shareUnits: null,
      }));
      break;
    }
    case "PERCENTAGE": {
      const percentages = input.split.participants.map((participant) => ({
        memberId: participant.memberId,
        basisPoints: parsePercentageBasisPoints(participant.percentage),
      }));
      const basisPointsByMember = new Map(
        percentages.map((participant) => [participant.memberId, participant.basisPoints]),
      );
      splits = allocateByPercentage(amountMinor, percentages).map((allocation) => ({
        ...allocation,
        percentageBasisPoints: basisPointsByMember.get(allocation.memberId) ?? null,
        shareUnits: null,
      }));
      break;
    }
    case "SHARES": {
      const shares = input.split.participants.map((participant) => ({
        memberId: participant.memberId,
        weight: BigInt(participant.shares),
      }));
      const sharesByMember = new Map(shares.map((participant) => [participant.memberId, participant.weight]));
      splits = allocateByWeight(amountMinor, shares).map((allocation) => ({
        ...allocation,
        percentageBasisPoints: null,
        shareUnits: sharesByMember.get(allocation.memberId) ?? null,
      }));
      break;
    }
  }

  if (splits.reduce((sum, split) => sum + split.amountMinor, 0n) !== amountMinor) {
    throw new AllocationError("Participant shares must equal the expense total");
  }

  return {
    description: input.description,
    notes: input.notes || null,
    amountMinor,
    expenseDate: parseExpenseDate(input.expenseDate),
    splitMethod: input.split.method,
    payers,
    splits,
  };
}

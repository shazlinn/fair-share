export type WeightedParticipant = Readonly<{
  memberId: string;
  weight: bigint;
}>;

export type Allocation = Readonly<{
  memberId: string;
  amountMinor: bigint;
}>;

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllocationError";
  }
}

function compareMemberIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function allocateByWeight(
  totalMinor: bigint,
  participants: readonly WeightedParticipant[],
): Allocation[] {
  if (totalMinor < 0n) {
    throw new AllocationError("Allocation total cannot be negative");
  }

  if (participants.length === 0) {
    throw new AllocationError("At least one participant is required");
  }

  const ids = new Set<string>();
  let totalWeight = 0n;

  for (const participant of participants) {
    if (!participant.memberId || ids.has(participant.memberId)) {
      throw new AllocationError("Participant IDs must be non-empty and unique");
    }
    if (participant.weight < 0n) {
      throw new AllocationError("Participant weights cannot be negative");
    }

    ids.add(participant.memberId);
    totalWeight += participant.weight;
  }

  if (totalWeight === 0n) {
    throw new AllocationError("At least one participant must have a positive weight");
  }

  const working = participants.map((participant) => {
    const weightedTotal = totalMinor * participant.weight;
    return {
      memberId: participant.memberId,
      amountMinor: weightedTotal / totalWeight,
      remainder: weightedTotal % totalWeight,
      hasPositiveWeight: participant.weight > 0n,
    };
  });

  const allocated = working.reduce((sum, item) => sum + item.amountMinor, 0n);
  let remaining = totalMinor - allocated;
  const remainderOrder = working
    .filter((item) => item.hasPositiveWeight)
    .sort((left, right) => {
      if (left.remainder > right.remainder) return -1;
      if (left.remainder < right.remainder) return 1;
      return compareMemberIds(left.memberId, right.memberId);
    });

  for (const item of remainderOrder) {
    if (remaining === 0n) break;
    item.amountMinor += 1n;
    remaining -= 1n;
  }

  if (remaining !== 0n) {
    throw new AllocationError("Unable to distribute the full allocation total");
  }

  return working
    .map(({ memberId, amountMinor }) => ({ memberId, amountMinor }))
    .sort((left, right) => compareMemberIds(left.memberId, right.memberId));
}

export function allocateEqually(totalMinor: bigint, memberIds: readonly string[]) {
  return allocateByWeight(
    totalMinor,
    memberIds.map((memberId) => ({ memberId, weight: 1n })),
  );
}

export function allocateByPercentage(
  totalMinor: bigint,
  participants: readonly Readonly<{ memberId: string; basisPoints: number }>[],
) {
  const totalBasisPoints = participants.reduce((sum, item) => sum + item.basisPoints, 0);

  if (
    participants.some(
      ({ basisPoints }) => !Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000,
    ) || totalBasisPoints !== 10_000
  ) {
    throw new AllocationError("Percentage splits must total exactly 10,000 basis points");
  }

  return allocateByWeight(
    totalMinor,
    participants.map(({ memberId, basisPoints }) => ({
      memberId,
      weight: BigInt(basisPoints),
    })),
  );
}

export function validateExactAllocation(
  totalMinor: bigint,
  allocations: readonly Allocation[],
): Allocation[] {
  if (allocations.length === 0) {
    throw new AllocationError("At least one participant is required");
  }

  const ids = new Set<string>();
  let allocated = 0n;
  for (const allocation of allocations) {
    if (!allocation.memberId || ids.has(allocation.memberId)) {
      throw new AllocationError("Participant IDs must be non-empty and unique");
    }
    if (allocation.amountMinor < 0n) {
      throw new AllocationError("Exact split amounts cannot be negative");
    }
    ids.add(allocation.memberId);
    allocated += allocation.amountMinor;
  }

  if (allocated !== totalMinor) {
    throw new AllocationError("Exact split amounts must equal the expense total");
  }

  return [...allocations].sort((left, right) => compareMemberIds(left.memberId, right.memberId));
}

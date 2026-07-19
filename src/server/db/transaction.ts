import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

export type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const MAX_SERIALIZATION_ATTEMPTS = 3;

export async function runSerializable<T>(operation: (transaction: TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      const shouldRetry =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!shouldRetry || attempt === MAX_SERIALIZATION_ATTEMPTS) throw error;
    }
  }

  throw new Error("Serializable transaction retry loop exited unexpectedly");
}

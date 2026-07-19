"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/features/expenses/actions";

export function DeleteExpenseButton({ groupId, expenseId, version }: { groupId: string; expenseId: string; version: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <div className="space-y-2"><Button variant="destructive" disabled={isPending} onClick={() => {
    if (!window.confirm("Delete this expense? Its financial effect will be removed from balances.")) return;
    startTransition(async () => {
      const result = await deleteExpense({ groupId, expenseId, expectedVersion: version });
      if (!result.ok) { setError(result.error); return; }
      router.push(`/groups/${groupId}`);
      router.refresh();
    });
  }}>{isPending ? "Deleting…" : "Delete expense"}</Button>{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>;
}

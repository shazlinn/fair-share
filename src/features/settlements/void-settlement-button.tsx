"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { voidSettlement } from "@/features/settlements/actions";

export function VoidSettlementButton({ groupId, settlementId, version }: { groupId: string; settlementId: string; version: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <div className="space-y-1 text-right"><Button size="sm" variant="outline" disabled={isPending} onClick={() => {
    if (!window.confirm("Void this repayment? The outstanding balances will be restored.")) return;
    startTransition(async () => {
      const result = await voidSettlement({ groupId, settlementId, expectedVersion: version });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }}>{isPending ? "Voiding…" : "Void"}</Button>{error ? <p className="max-w-52 text-xs text-destructive">{error}</p> : null}</div>;
}

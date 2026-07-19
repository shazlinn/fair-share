"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordSettlement } from "@/features/settlements/actions";
import {
  settlementFieldsSchema,
  type SettlementFieldsInput,
} from "@/features/settlements/schemas";

type MemberOption = Readonly<{ id: string; name: string; active: boolean }>;
type SuggestedTransfer = Readonly<{
  fromUserId: string;
  toUserId: string;
  amount: string;
  label: string;
}>;

export function SettlementForm({
  groupId,
  currentUserId,
  canRecordAny,
  members,
  suggestions,
  defaultDate,
}: {
  groupId: string;
  currentUserId: string;
  canRecordAny: boolean;
  members: readonly MemberOption[];
  suggestions: readonly SuggestedTransfer[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string>();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const firstSuggestion = suggestions[0];
  const form = useForm<SettlementFieldsInput>({
    resolver: zodResolver(settlementFieldsSchema),
    defaultValues: {
      fromUserId: firstSuggestion?.fromUserId ?? currentUserId,
      toUserId: firstSuggestion?.toUserId ?? "",
      amount: firstSuggestion?.amount ?? "",
      memo: "",
      settledAt: defaultDate,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(undefined);
    if (!canRecordAny && values.fromUserId !== currentUserId && values.toUserId !== currentUserId) {
      setServerError("You must be the sender or receiver of the repayment");
      return;
    }
    startTransition(async () => {
      const result = await recordSettlement({ ...values, groupId, idempotencyKey });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setIdempotencyKey(crypto.randomUUID());
      form.setValue("amount", "");
      form.setValue("memo", "");
      router.refresh();
    });
  });

  return <div className="space-y-5">
    {suggestions.length ? <div className="space-y-2"><p className="text-sm font-medium">Suggested transfers</p>{suggestions.map((suggestion) => <button key={`${suggestion.fromUserId}-${suggestion.toUserId}`} type="button" className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted" onClick={() => {
      form.setValue("fromUserId", suggestion.fromUserId);
      form.setValue("toUserId", suggestion.toUserId);
      form.setValue("amount", suggestion.amount);
    }}>{suggestion.label}</button>)}</div> : <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">All balances are settled.</div>}
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {serverError ? <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="settlement-from">Sender</Label><select id="settlement-from" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("fromUserId")}><option value="">Select sender</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.active ? "" : " (former member)"}</option>)}</select><p className="text-sm text-destructive">{form.formState.errors.fromUserId?.message}</p></div>
        <div className="space-y-2"><Label htmlFor="settlement-to">Receiver</Label><select id="settlement-to" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("toUserId")}><option value="">Select receiver</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.active ? "" : " (former member)"}</option>)}</select><p className="text-sm text-destructive">{form.formState.errors.toUserId?.message}</p></div>
        <div className="space-y-2"><Label htmlFor="settlement-amount">Amount</Label><Input id="settlement-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} /><p className="text-sm text-destructive">{form.formState.errors.amount?.message}</p></div>
        <div className="space-y-2"><Label htmlFor="settled-at">Repayment date</Label><Input id="settled-at" type="date" {...form.register("settledAt")} /><p className="text-sm text-destructive">{form.formState.errors.settledAt?.message}</p></div>
      </div>
      <div className="space-y-2"><Label htmlFor="settlement-memo">Memo <span className="text-muted-foreground">(optional)</span></Label><Input id="settlement-memo" placeholder="Bank transfer" {...form.register("memo")} /><p className="text-sm text-destructive">{form.formState.errors.memo?.message}</p></div>
      <Button type="submit" disabled={isPending || suggestions.length === 0}>{isPending ? "Recording…" : "Record repayment"}</Button>
    </form>
  </div>;
}

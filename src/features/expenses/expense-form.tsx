"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, editExpense } from "@/features/expenses/actions";

export type ExpenseFormMember = Readonly<{ id: string; name: string; email: string }>;
export type ExpenseFormInitial = Readonly<{
  expenseId: string;
  version: number;
  description: string;
  notes: string;
  amount: string;
  expenseDate: string;
  splitMethod: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
  payers: ReadonlyArray<{ memberId: string; value: string }>;
  participants: ReadonlyArray<{ memberId: string; value: string }>;
}>;

type BasicFields = {
  description: string;
  notes: string;
  amount: string;
  expenseDate: string;
};

const methodLabels = {
  EQUAL: "Equal",
  EXACT: "Exact amounts",
  PERCENTAGE: "Percentages",
  SHARES: "Shares",
} as const;

export function ExpenseForm({
  groupId,
  currentUserId,
  members,
  initial,
  defaultExpenseDate,
}: {
  groupId: string;
  currentUserId: string;
  members: readonly ExpenseFormMember[];
  initial?: ExpenseFormInitial;
  defaultExpenseDate?: string;
}) {
  const router = useRouter();
  const [createIdempotencyKey] = useState(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string>();
  const [method, setMethod] = useState<keyof typeof methodLabels>(initial?.splitMethod ?? "EQUAL");
  const initialPayers = useMemo(() => new Map(initial?.payers.map((item) => [item.memberId, item.value])), [initial]);
  const initialParticipants = useMemo(
    () => new Map(initial?.participants.map((item) => [item.memberId, item.value])),
    [initial],
  );
  const [payerValues, setPayerValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((member) => [member.id, initialPayers.get(member.id) ?? ""])),
  );
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(
    () => new Set(initial ? initial.payers.map((item) => item.memberId) : [currentUserId]),
  );
  const [participantValues, setParticipantValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((member) => [
        member.id,
        initialParticipants.get(member.id) ?? (initial ? "" : method === "SHARES" ? "1" : "selected"),
      ]),
    ),
  );
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    () => new Set(initial ? initial.participants.map((item) => item.memberId) : members.map((member) => member.id)),
  );
  const form = useForm<BasicFields>({
    defaultValues: {
      description: initial?.description ?? "",
      notes: initial?.notes ?? "",
      amount: initial?.amount ?? "",
      expenseDate: initial?.expenseDate ?? defaultExpenseDate ?? new Date().toISOString().slice(0, 10),
    },
  });

  function togglePayer(memberId: string, checked: boolean) {
    setSelectedPayers((current) => {
      const next = new Set(current);
      if (checked) next.add(memberId); else next.delete(memberId);
      return next;
    });
    if (checked && memberId === currentUserId && !payerValues[memberId]) {
      setPayerValues((current) => ({ ...current, [memberId]: form.getValues("amount") }));
    }
  }

  function toggleParticipant(memberId: string, checked: boolean) {
    setSelectedParticipants((current) => {
      const next = new Set(current);
      if (checked) next.add(memberId); else next.delete(memberId);
      return next;
    });
    if (checked && method === "SHARES" && !participantValues[memberId]) {
      setParticipantValues((current) => ({ ...current, [memberId]: "1" }));
    }
  }

  const onSubmit = form.handleSubmit((fields) => {
    setServerError(undefined);
    const payers = members
      .filter((member) => selectedPayers.has(member.id))
      .map((member) => ({ memberId: member.id, amount: payerValues[member.id] }));
    const selected = members.filter((member) => selectedParticipants.has(member.id));
    const split =
      method === "EQUAL"
        ? { method, participantIds: selected.map((member) => member.id) }
        : method === "EXACT"
          ? {
              method,
              participants: selected.map((member) => ({ memberId: member.id, amount: participantValues[member.id] })),
            }
          : method === "PERCENTAGE"
            ? {
                method,
                participants: selected.map((member) => ({ memberId: member.id, percentage: participantValues[member.id] })),
              }
            : {
                method,
                participants: selected.map((member) => ({ memberId: member.id, shares: participantValues[member.id] })),
              };
    const values = { groupId, ...fields, payers, split };

    startTransition(async () => {
      let expenseId: string;
      if (initial) {
        const result = await editExpense({ ...values, expenseId: initial.expenseId, expectedVersion: initial.version });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        expenseId = initial.expenseId;
      } else {
        const result = await createExpense({ ...values, idempotencyKey: createIdempotencyKey });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        expenseId = result.data.expenseId;
      }
      router.push(`/groups/${groupId}/expenses/${expenseId}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {serverError ? <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" placeholder="Dinner at Jalan Alor" {...form.register("description", { required: true })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Total amount</Label>
          <Input id="amount" inputMode="decimal" placeholder="100.00" {...form.register("amount", { required: true })} />
          <p className="text-xs text-muted-foreground">Use digits and up to two decimal places.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expenseDate">Expense date</Label>
          <Input id="expenseDate" type="date" {...form.register("expenseDate", { required: true })} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea id="notes" placeholder="Add context for the group" {...form.register("notes")} />
        </div>
      </div>

      <section className="space-y-3">
        <div><h2 className="font-semibold">Who paid?</h2><p className="text-sm text-muted-foreground">Selected payer amounts must add up to the total.</p></div>
        <div className="divide-y rounded-lg border">
          {members.map((member) => {
            const selected = selectedPayers.has(member.id);
            return <div key={member.id} className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_12rem]">
              <label className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={selected} onChange={(event) => togglePayer(member.id, event.target.checked)} /><span className="truncate text-sm font-medium">{member.name}<span className="ml-2 font-normal text-muted-foreground">{member.email}</span></span></label>
              {selected ? <Input aria-label={`Amount paid by ${member.name}`} inputMode="decimal" placeholder="0.00" value={payerValues[member.id]} onChange={(event) => setPayerValues((current) => ({ ...current, [member.id]: event.target.value }))} /> : null}
            </div>;
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="font-semibold">How should it be split?</h2><p className="text-sm text-muted-foreground">Rounding remainders are assigned deterministically by member ID.</p></div>
        <div className="grid gap-2 sm:grid-cols-4">
          {(Object.keys(methodLabels) as Array<keyof typeof methodLabels>).map((item) => <Button key={item} type="button" variant={method === item ? "default" : "outline"} onClick={() => {
            setMethod(item);
            setParticipantValues((current) => Object.fromEntries(members.map((member) => {
              const value = current[member.id] ?? "";
              return [member.id, value ? (item === "EQUAL" ? "selected" : item === "SHARES" && value === "selected" ? "1" : value === "selected" ? "" : value) : ""];
            })));
          }}>{methodLabels[item]}</Button>)}
        </div>
        <div className="divide-y rounded-lg border">
          {members.map((member) => {
            const selected = selectedParticipants.has(member.id);
            const suffix = method === "PERCENTAGE" ? "%" : method === "SHARES" ? "shares" : "";
            return <div key={member.id} className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_12rem]">
              <label className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={selected} onChange={(event) => toggleParticipant(member.id, event.target.checked)} /><span className="truncate text-sm font-medium">{member.name}</span></label>
              {selected && method !== "EQUAL" ? <div className="flex items-center gap-2"><Input aria-label={`${methodLabels[method]} for ${member.name}`} inputMode="decimal" placeholder={method === "EXACT" ? "0.00" : method === "PERCENTAGE" ? "0" : "1"} value={participantValues[member.id]} onChange={(event) => setParticipantValues((current) => ({ ...current, [member.id]: event.target.value }))} />{suffix ? <span className="w-12 text-xs text-muted-foreground">{suffix}</span> : null}</div> : null}
            </div>;
          })}
        </div>
      </section>
      <div className="flex gap-3"><Button type="submit" disabled={isPending}>{isPending ? "Saving…" : initial ? "Save changes" : "Create expense"}</Button><Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>Cancel</Button></div>
    </form>
  );
}

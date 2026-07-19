"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteReceipt, uploadReceipt } from "@/features/receipts/actions";

export function ReceiptUploadForm({ groupId, expenseId }: { groupId: string; expenseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    setError(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("groupId", groupId);
    data.set("expenseId", expenseId);
    startTransition(async () => {
      const result = await uploadReceipt(data);
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      router.refresh();
    });
  }}>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<Input aria-label="Receipt file" name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" disabled={isPending} /><p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or PDF up to 5 MB. File contents are validated on the server.</p><Button type="submit" disabled={isPending}>{isPending ? "Uploading…" : "Upload receipt"}</Button></form>;
}

export function DeleteReceiptButton({ groupId, expenseId, attachmentId }: { groupId: string; expenseId: string; attachmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <div className="space-y-1 text-right"><Button size="sm" variant="ghost" disabled={isPending} onClick={() => {
    if (!window.confirm("Delete this receipt? The stored file will be permanently removed.")) return;
    startTransition(async () => {
      const result = await deleteReceipt({ groupId, expenseId, attachmentId });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }}>{isPending ? "Deleting…" : "Delete"}</Button>{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvitation, revokeInvitation } from "@/features/invitations/actions";

export function InvitationCreator({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<{ invitePath?: string; error?: string }>();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="max-uses">Maximum uses</Label><Input id="max-uses" type="number" min={1} max={50} defaultValue={1} /></div>
        <div className="space-y-2"><Label htmlFor="expires-days">Expires in days</Label><Input id="expires-days" type="number" min={1} max={30} defaultValue={7} /></div>
      </div>
      <Button disabled={isPending} onClick={() => {
        const maxUses = Number((document.getElementById("max-uses") as HTMLInputElement).value);
        const expiresInDays = Number((document.getElementById("expires-days") as HTMLInputElement).value);
        startTransition(async () => {
          const created = await createInvitation({ groupId, maxUses, expiresInDays });
          if (!created.ok) setResult({ error: created.error });
          else {
            setResult({ invitePath: created.data.invitePath });
            router.refresh();
          }
        });
      }}>{isPending ? "Creating…" : "Create invitation link"}</Button>
      {result?.invitePath ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shown once—copy it now</p>
          <code className="mt-2 block break-all text-sm">{result.invitePath}</code>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${result.invitePath}`)}>Copy full link</Button>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInvitationButton({ groupId, invitationId }: { groupId: string; invitationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <div>
      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(async () => {
        const result = await revokeInvitation({ groupId, invitationId });
        if (!result.ok) setError(result.error);
        else router.refresh();
      })}>{isPending ? "Revoking…" : "Revoke"}</Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

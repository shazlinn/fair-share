"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/features/invitations/actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button className="w-full" disabled={isPending} onClick={() => startTransition(async () => {
        const result = await acceptInvitation(token);
        if (!result.ok) setError(result.error);
        else { router.push(`/groups/${result.data.groupId}`); router.refresh(); }
      })}>{isPending ? "Joining group…" : "Accept invitation"}</Button>
    </div>
  );
}

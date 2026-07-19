"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { removeGroupMember } from "@/features/groups/actions";

export function RemoveMemberButton({ groupId, memberUserId }: { groupId: string; memberUserId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <div className="text-right">
      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(async () => {
        const result = await removeGroupMember({ groupId, memberUserId });
        if (!result.ok) setError(result.error);
        else router.refresh();
      })}>{isPending ? "Removing…" : "Remove"}</Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { changeGroupArchivedStatus } from "@/features/groups/actions";

export function GroupStatusControl({ groupId, version, archived }: { groupId: string; version: number; archived: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button
        variant={archived ? "default" : "destructive"}
        disabled={isPending}
        onClick={() => startTransition(async () => {
          setError(undefined);
          const result = await changeGroupArchivedStatus({ groupId, expectedVersion: version, archived: !archived });
          if (!result.ok) setError(result.error);
          else router.refresh();
        })}
      >
        {isPending ? "Saving…" : archived ? "Restore group" : "Archive group"}
      </Button>
    </div>
  );
}

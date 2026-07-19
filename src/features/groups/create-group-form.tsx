"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createGroup } from "@/features/groups/actions";
import { createGroupSchema, type CreateGroupInput } from "@/features/groups/schemas";

export function CreateGroupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      currency: "MYR",
      timeZone: "Asia/Kuala_Lumpur",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createGroup(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/groups/${result.data.groupId}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {serverError ? <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="group-name">Group name</Label>
        <Input id="group-name" placeholder="Weekend in Penang" {...form.register("name")} />
        <p className="text-sm text-destructive">{form.formState.errors.name?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="group-description">Description <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="group-description" placeholder="What is this group for?" {...form.register("description")} />
        <p className="text-sm text-destructive">{form.formState.errors.description?.message}</p>
      </div>
      <input type="hidden" {...form.register("currency")} />
      <input type="hidden" {...form.register("timeZone")} />
      <Button type="submit" disabled={isPending}>{isPending ? "Creating…" : "Create group"}</Button>
    </form>
  );
}

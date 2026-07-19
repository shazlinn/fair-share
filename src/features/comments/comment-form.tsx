"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment, deleteComment } from "@/features/comments/actions";
import { createCommentSchema, type CreateCommentInput } from "@/features/comments/schemas";

export function CommentForm({ groupId, expenseId }: { groupId: string; expenseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: { groupId, expenseId, body: "" },
  });
  return <form className="space-y-3" onSubmit={form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const result = await createComment(values);
      if (!result.ok) { setError(result.error); return; }
      form.reset({ groupId, expenseId, body: "" });
      router.refresh();
    });
  })}>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<Textarea aria-label="Add a comment" placeholder="Add a comment for the group" {...form.register("body")} /><p className="text-sm text-destructive">{form.formState.errors.body?.message}</p><Button type="submit" disabled={isPending}>{isPending ? "Posting…" : "Post comment"}</Button></form>;
}

export function DeleteCommentButton({ groupId, expenseId, commentId }: { groupId: string; expenseId: string; commentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return <Button size="sm" variant="ghost" disabled={isPending} onClick={() => startTransition(async () => {
    const result = await deleteComment({ groupId, expenseId, commentId });
    if (result.ok) router.refresh();
  })}>{isPending ? "Deleting…" : "Delete"}</Button>;
}

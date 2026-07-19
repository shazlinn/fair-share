"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/features/profiles/actions";
import { updateProfileSchema, type UpdateProfileInput } from "@/features/profiles/schemas";

export function ProfileForm({ name, image }: { name: string; image: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [isPending, startTransition] = useTransition();
  const form = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema), defaultValues: { name, image } });

  const onSubmit = form.handleSubmit((values) => {
    setMessage({});
    startTransition(async () => {
      const result = await updateProfile(values);
      if (!result.ok) setMessage({ error: result.error });
      else { setMessage({ success: "Profile updated" }); router.refresh(); }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {message.error ? <Alert variant="destructive"><AlertDescription>{message.error}</AlertDescription></Alert> : null}
      {message.success ? <Alert><AlertDescription>{message.success}</AlertDescription></Alert> : null}
      <div className="space-y-2"><Label htmlFor="profile-name">Name</Label><Input id="profile-name" {...form.register("name")} /><p className="text-sm text-destructive">{form.formState.errors.name?.message}</p></div>
      <div className="space-y-2"><Label htmlFor="profile-image">Image URL <span className="text-muted-foreground">(optional)</span></Label><Input id="profile-image" type="url" {...form.register("image")} /><p className="text-sm text-destructive">{form.formState.errors.image?.message}</p></div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}

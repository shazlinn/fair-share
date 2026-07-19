"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword } from "@/features/auth/actions";
import { signInSchema, type SignInInput } from "@/features/auth/schemas";

export function SignInForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await signInWithPassword(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {serverError ? (
        <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        <p className="text-sm text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
        <p className="text-sm text-destructive">{form.formState.errors.password?.message}</p>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to FairShare? <Link href="/register" className="font-medium text-emerald-700 hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

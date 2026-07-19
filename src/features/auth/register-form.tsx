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
import { registerUser, signInWithPassword } from "@/features/auth/actions";
import { registrationSchema, type RegistrationInput } from "@/features/auth/schemas";

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const form = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const registration = await registerUser(values);
      if (!registration.ok) {
        setServerError(registration.error);
        return;
      }
      const signedIn = await signInWithPassword({ email: values.email, password: values.password });
      if (!signedIn.ok) {
        router.push("/sign-in");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {serverError ? (
        <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="name" {...form.register("name")} />
        <p className="text-sm text-destructive">{form.formState.errors.name?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        <p className="text-sm text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        <p className="text-sm text-destructive">{form.formState.errors.password?.message}</p>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already registered? <Link href="/sign-in" className="font-medium text-emerald-700 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

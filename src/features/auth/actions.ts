"use server";

import { AuthError } from "next-auth";

import { Prisma } from "@/generated/prisma/client";
import { signIn, signOut } from "@/auth";
import { registrationSchema, signInSchema } from "@/features/auth/schemas";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword } from "@/server/auth/password";
import { prisma } from "@/server/db/prisma";

export async function registerUser(input: unknown): Promise<ActionResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid registration details" };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "An account with this email already exists" };
    }
    return { ok: false, error: "Unable to create your account. Please try again." };
  }
}

export async function signInWithPassword(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sign-in details" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Email or password is incorrect" };
    }
    return { ok: false, error: "Unable to sign in. Please try again." };
  }
}

export async function signOutUser() {
  await signOut({ redirectTo: "/" });
}

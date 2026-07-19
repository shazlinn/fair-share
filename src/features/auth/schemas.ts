import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;

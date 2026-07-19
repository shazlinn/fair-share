import { describe, expect, it } from "vitest";

import { registrationSchema, signInSchema } from "@/features/auth/schemas";

describe("authentication schemas", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(
      registrationSchema.parse({
        name: "  Shazlin  ",
        email: "  USER@Example.COM ",
        password: "twelve-characters",
      }),
    ).toEqual({
      name: "Shazlin",
      email: "user@example.com",
      password: "twelve-characters",
    });
  });

  it("rejects short registration passwords and malformed sign-in input", () => {
    expect(
      registrationSchema.safeParse({ name: "User", email: "user@example.com", password: "short" }).success,
    ).toBe(false);
    expect(signInSchema.safeParse({ email: "not-an-email", password: "password" }).success).toBe(false);
  });
});

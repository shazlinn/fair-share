import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("stores a versioned salted scrypt hash and verifies the password", async () => {
    const first = await hashPassword("a very strong password");
    const second = await hashPassword("a very strong password");

    expect(first).toMatch(/^scrypt\$v1\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("a very strong password", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false);
  });

  it.each([
    "",
    "bcrypt$v1$salt$key",
    "scrypt$v2$salt$key",
    "scrypt$v1$invalid$key$extra",
    "scrypt$v1$c2hvcnQ$c2hvcnQ",
  ])("rejects malformed stored hash %s", async (storedHash) => {
    await expect(verifyPassword("password", storedHash)).resolves.toBe(false);
  });
});

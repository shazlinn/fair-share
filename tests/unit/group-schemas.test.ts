import { describe, expect, it } from "vitest";

import { createGroupSchema, groupStatusChangeSchema } from "@/features/groups/schemas";
import { createInvitationSchema, invitationTokenSchema } from "@/features/invitations/schemas";

describe("group and invitation schemas", () => {
  it("accepts the supported currency and a real IANA timezone", () => {
    expect(
      createGroupSchema.parse({
        name: "  Penang trip  ",
        description: "  Shared travel costs  ",
        currency: "MYR",
        timeZone: "Asia/Kuala_Lumpur",
      }),
    ).toEqual({
      name: "Penang trip",
      description: "Shared travel costs",
      currency: "MYR",
      timeZone: "Asia/Kuala_Lumpur",
    });
  });

  it("rejects unsupported currency, timezone, and invalid versions", () => {
    expect(createGroupSchema.safeParse({ name: "Group", description: "", currency: "USD", timeZone: "Mars/Olympus" }).success).toBe(false);
    expect(groupStatusChangeSchema.safeParse({ groupId: "bad-id", expectedVersion: 0, archived: true }).success).toBe(false);
  });

  it("limits invitation lifetime, use count, and token size", () => {
    expect(createInvitationSchema.safeParse({ groupId: "cm12345678901234567890123", maxUses: 51, expiresInDays: 7 }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ groupId: "cm12345678901234567890123", maxUses: 1, expiresInDays: 31 }).success).toBe(false);
    expect(invitationTokenSchema.safeParse("too-short").success).toBe(false);
    expect(invitationTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  canRecordSettlement,
  canVoidSettlement,
} from "@/features/settlements/authorization";

describe("settlement authorization policy", () => {
  it("lets owners record repayments for any group parties", () => {
    expect(canRecordSettlement("owner", "OWNER", "alice", "bob")).toBe(true);
  });

  it("lets members record repayments only when they are a party", () => {
    expect(canRecordSettlement("alice", "MEMBER", "alice", "bob")).toBe(true);
    expect(canRecordSettlement("bob", "MEMBER", "alice", "bob")).toBe(true);
    expect(canRecordSettlement("chen", "MEMBER", "alice", "bob")).toBe(false);
  });

  it("lets only the recorder or owner void a repayment", () => {
    expect(canVoidSettlement("recorder", "MEMBER", "recorder")).toBe(true);
    expect(canVoidSettlement("other", "MEMBER", "recorder")).toBe(false);
    expect(canVoidSettlement("owner", "OWNER", "recorder")).toBe(true);
  });
});

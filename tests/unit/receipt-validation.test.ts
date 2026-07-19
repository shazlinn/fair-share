import { describe, expect, it } from "vitest";

import {
  MAX_RECEIPT_BYTES,
  ReceiptValidationError,
  validateReceiptBytes,
} from "@/features/receipts/validate-file";

describe("receipt file validation", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  ])("accepts a real %s signature", (contentType, signature) => {
    expect(() => validateReceiptBytes(contentType, new Uint8Array(signature))).not.toThrow();
  });

  it("rejects an allowed MIME type with mismatched contents", () => {
    expect(() => validateReceiptBytes("application/pdf", new Uint8Array([1, 2, 3]))).toThrow(
      "do not match",
    );
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(() => validateReceiptBytes("text/plain", new Uint8Array([1]))).toThrow(
      ReceiptValidationError,
    );
    expect(() => validateReceiptBytes("image/png", new Uint8Array())).toThrow("between 1 byte");
    expect(() =>
      validateReceiptBytes("image/jpeg", new Uint8Array(MAX_RECEIPT_BYTES + 1)),
    ).toThrow("between 1 byte");
  });
});

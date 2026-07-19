export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const RECEIPT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export class ReceiptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptValidationError";
  }
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

export function validateReceiptBytes(contentType: string, bytes: Uint8Array) {
  if (!RECEIPT_CONTENT_TYPES.includes(contentType as (typeof RECEIPT_CONTENT_TYPES)[number])) {
    throw new ReceiptValidationError("Receipt must be a JPEG, PNG, WebP, or PDF file");
  }
  if (bytes.length === 0 || bytes.length > MAX_RECEIPT_BYTES) {
    throw new ReceiptValidationError("Receipt must be between 1 byte and 5 MB");
  }

  const valid =
    (contentType === "image/jpeg" && hasPrefix(bytes, [0xff, 0xd8, 0xff])) ||
    (contentType === "image/png" && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (contentType === "application/pdf" && hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) ||
    (contentType === "image/webp" &&
      hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      hasPrefix(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]));
  if (!valid) throw new ReceiptValidationError("Receipt contents do not match the declared file type");
}

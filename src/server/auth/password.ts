import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt);
  return `scrypt$v1$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, version, saltValue, keyValue, ...extra] = storedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    version !== "v1" ||
    !saltValue ||
    !keyValue ||
    extra.length > 0
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expectedKey = Buffer.from(keyValue, "base64url");
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;

    const actualKey = await deriveKey(password, salt);
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

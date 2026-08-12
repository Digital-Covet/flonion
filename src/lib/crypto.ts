import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  hkdfSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

/**
 * Root secret for all derived keys.
 *
 * `TOKEN_ENCRYPTION_KEY` is preferred. `COOKIE_SECRET` is accepted as a
 * fallback so existing deployments keep working, but a dedicated key is
 * better: it can be rotated without invalidating unrelated signed cookies.
 */
function getRootSecret(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.COOKIE_SECRET;
  if (!key) {
    throw new Error(
      "Missing environment variable: TOKEN_ENCRYPTION_KEY (or COOKIE_SECRET)",
    );
  }
  return key;
}

/**
 * Derive a purpose-scoped key so that a signing key and an encryption key
 * never collide, even though they share a root secret.
 */
function deriveKey(purpose: string, length: number): Buffer {
  return Buffer.from(
    hkdfSync("sha256", getRootSecret(), "revme-static-salt", purpose, length),
  );
}

export function sign(data: string, purpose = "generic-sig"): string {
  return createHmac("sha256", deriveKey(purpose, 32)).update(data).digest("hex");
}

/**
 * Constant-time signature comparison. A plain `===` on an HMAC leaks
 * information about how many leading bytes matched.
 */
export function verifySignature(
  data: string,
  signature: string,
  purpose = "generic-sig",
): boolean {
  const expected = sign(data, purpose);
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(signature, "utf-8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

const ENCRYPTION_PURPOSE = "token-encryption";
const IV_LENGTH = 12;

/**
 * AES-256-GCM. Output is `iv.ciphertext.authTag`, all base64url.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey(ENCRYPTION_PURPOSE, 32);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    authTag.toString("base64url"),
  ].join(".");
}

/**
 * Returns null rather than throwing on tampered or malformed input, so
 * callers can treat "undecryptable" the same as "absent".
 */
export function decrypt(payload: string): string | null {
  try {
    const [ivPart, ciphertextPart, authTagPart] = payload.split(".");
    if (!ivPart || !ciphertextPart || !authTagPart) return null;

    const key = deriveKey(ENCRYPTION_PURPOSE, 32);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    return null;
  }
}

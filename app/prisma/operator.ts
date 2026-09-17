import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createCookie, redirect } from "react-router";

/**
 * Operator identity for the desk.
 *
 * Backed by a per-operator token map in the environment for now. Swapping in
 * a real session check later touches only this file.
 *
 * The environment holds only SHA-256 digests of the tokens, and an operator's
 * `id` is a separate, non-secret name. The id is written to the audit log,
 * the Verification table, and Session.impersonatedBy, so it must never be the
 * credential itself.
 */

export interface Operator {
  id: string;
  name: string;
}

const COOKIE_NAME = "flonion-desk-operator";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

const OPERATOR_ID_RE = /^[a-z0-9_-]{1,64}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

interface OperatorEntry {
  operator: Operator;
  digest: Buffer;
}

/**
 * Parse the operator map from the environment.
 *
 * Format: `DESK_OPERATORS=op_jane:<sha256 hex of token>,op_bob:<sha256 hex>`
 * Generate a digest with:
 *   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" <token>
 *
 * Malformed entries are skipped rather than guessed at, so a misconfiguration
 * locks operators out instead of accepting something unintended.
 */
function getOperatorEntries(): OperatorEntry[] {
  const raw = process.env.DESK_OPERATORS ?? "";
  const entries: OperatorEntry[] = [];
  for (const entry of raw.split(",")) {
    const [id, digest, ...rest] = entry.trim().split(":");
    if (rest.length > 0 || !id || !digest) continue;
    const normalizedDigest = digest.trim().toLowerCase();
    if (!OPERATOR_ID_RE.test(id) || !SHA256_HEX_RE.test(normalizedDigest)) {
      continue;
    }
    entries.push({
      operator: { id, name: id },
      digest: Buffer.from(normalizedDigest, "hex"),
    });
  }
  return entries;
}

/**
 * Resolve a presented token to an operator. Compares SHA-256 digests in
 * constant time, and checks every entry so timing does not reveal which one
 * matched.
 */
export function operatorFromToken(token: string): Operator | null {
  if (!token) return null;
  const presented = createHash("sha256").update(token).digest();
  let match: Operator | null = null;
  for (const entry of getOperatorEntries()) {
    if (timingSafeEqual(presented, entry.digest)) match = entry.operator;
  }
  return match;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export const operatorCookie = createCookie(COOKIE_NAME, {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
});

/**
 * Read the current operator from the request cookie.
 * Returns null if no valid operator cookie is present.
 */
export async function currentOperator(
  request: Request,
): Promise<Operator | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const jar = await operatorCookie.parse(cookieHeader);
  const token = jar?.token;
  if (typeof token !== "string" || !token) return null;

  return operatorFromToken(token);
}

/**
 * Read the current operator or redirect to the unlock page.
 */
export async function requireOperator(request: Request): Promise<Operator> {
  const op = await currentOperator(request);
  if (!op) throw redirect("/console.unlock");
  return op;
}

/**
 * Read the current operator for read-only operations.
 * Returns null if no operator — callers decide whether to 403 or degrade.
 */
export async function requireOperatorRead(
  request: Request,
): Promise<Operator | null> {
  return currentOperator(request);
}

/**
 * `Set-Cookie` value that stores the operator token. Serialized through
 * `operatorCookie` so `currentOperator` can parse it back.
 */
export function serializeOperatorCookie(token: string): Promise<string> {
  return operatorCookie.serialize({ token });
}

/**
 * `Set-Cookie` value that clears the operator cookie.
 */
export function serializeClearedOperatorCookie(): Promise<string> {
  return operatorCookie.serialize("", { maxAge: 0 });
}

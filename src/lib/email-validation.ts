import type { MxRecord } from "node:dns";
import { Resolver } from "node:dns/promises";
import { validateEmail } from "better-auth-harmony/email";
import { isDisposableEmailDomain } from "disposable-email-domains-js";

/**
 * Disposable domains (or MX host suffixes) seen in the wild that neither list
 * carries yet. Matched on the address domain, every parent of it, and every
 * MX host, so one provider domain here covers all of its rotating domains.
 */
const EXTRA_DISPOSABLE_DOMAINS = new Set<string>([
  "omanarts.com", // temp-mail.org, 2026-09-28
]);

const VERDICT_TTL_MS = 60 * 60 * 1000;
/** Short, so a DNS outage stops failing open soon after it ends. */
const FAIL_OPEN_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_DOMAINS = 5_000;

type ResolveMx = (domain: string) => Promise<MxRecord[]>;

interface CacheEntry {
  ok: boolean;
  expires: number;
}

/** `a.b.tmp.com` -> `a.b.tmp.com`, `b.tmp.com`, `tmp.com`; never the bare TLD. */
function domainAndParents(host: string): string[] {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".");
  const out: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) {
    out.push(labels.slice(i).join("."));
  }
  return out;
}

/**
 * Only the curated disposable-email-domains list and our own set. mailchecker
 * is deliberately not consulted for MX hosts: it lists `yandex.net`, which
 * would reject every business domain hosted on Yandex 360.
 */
function isListedDisposable(host: string): boolean {
  return domainAndParents(host).some(
    (d) => EXTRA_DISPOSABLE_DOMAINS.has(d) || isDisposableEmailDomain(d),
  );
}

function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Validator for better-auth-harmony. Keeps harmony's default (isEmail +
 * mailchecker), then rejects domains on a second disposable list, domains
 * that do not exist or refuse mail (null MX), and domains whose MX hosts
 * belong to a disposable provider. Temp-mail services rotate fresh domains
 * faster than any list updates, but they all deliver to their own servers:
 * e.g. dcpa.net and wshu.net both route to in.mail.tm.
 *
 * Any other DNS failure fails open: a resolver hiccup must never lock people
 * out of sign-up or sign-in.
 */
export function createEmailValidator({
  resolveMx,
  now = Date.now,
}: {
  resolveMx: ResolveMx;
  now?: () => number;
}) {
  const cache = new Map<string, CacheEntry>();

  function remember(domain: string, ok: boolean, ttl: number): boolean {
    if (cache.size >= MAX_CACHED_DOMAINS) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(domain, { ok, expires: now() + ttl });
    return ok;
  }

  async function checkMx(domain: string): Promise<boolean> {
    const cached = cache.get(domain);
    if (cached && cached.expires > now()) return cached.ok;
    cache.delete(domain);

    let records: MxRecord[];
    try {
      records = await resolveMx(domain);
    } catch (error) {
      if (errorCode(error) === "ENOTFOUND") {
        return remember(domain, false, VERDICT_TTL_MS);
      }
      // ENODATA (no MX, so mail falls back to the A record), timeouts,
      // SERVFAIL and anything else.
      return remember(domain, true, FAIL_OPEN_TTL_MS);
    }

    const hosts = records.map((r) => r.exchange);
    const nullMx = hosts.length === 1 && (hosts[0] === "" || hosts[0] === ".");
    const ok = !nullMx && !hosts.some(isListedDisposable);
    return remember(domain, ok, VERDICT_TTL_MS);
  }

  return async (email: string): Promise<boolean> => {
    if (!validateEmail(email)) return false;
    const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
    if (isListedDisposable(domain)) return false;
    return checkMx(domain);
  };
}

const resolver = new Resolver({ timeout: 2000, tries: 2 });

export const validateAuthEmail = createEmailValidator({
  resolveMx: (domain) => resolver.resolveMx(domain),
});

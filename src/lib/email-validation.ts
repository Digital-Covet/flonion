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

/**
 * Mail servers of disposable providers whose rotating domains each get their
 * own `mail.<domain>` MX host, so only the address gives them away.
 */
const DISPOSABLE_MX_IPS = new Set<string>([
  "134.199.178.234", // temp-mail.org: omanarts.com, ncleap.com (2026-09-28)
]);

/**
 * The npm package is a snapshot that trails this file by days (it lacked
 * ncleap.com and ~300 others on 2026-09-28), so the live list is fetched and
 * the package only covers the time before the first fetch lands.
 */
const UPSTREAM_BLOCKLIST_URL =
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";
const BLOCKLIST_REFRESH_MS = 12 * 60 * 60 * 1000;
const BLOCKLIST_RETRY_MS = 15 * 60 * 1000;
/** How long a request waits for the very first fetch before using the package. */
const FIRST_LOAD_WAIT_MS = 1500;
/** Anything smaller is a truncated body or an error page, not the list. */
const MIN_BLOCKLIST_SIZE = 5_000;

const VERDICT_TTL_MS = 60 * 60 * 1000;
/** Short, so a DNS outage stops failing open soon after it ends. */
const FAIL_OPEN_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_DOMAINS = 5_000;

type ResolveMx = (domain: string) => Promise<MxRecord[]>;
type Resolve4 = (host: string) => Promise<string[]>;
type FetchBlocklist = () => Promise<Set<string>>;

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

/** One domain per line; `#` comments and blank lines skipped. */
export function parseBlocklist(text: string): Set<string> {
  const domains = new Set<string>();
  for (const line of text.split("\n")) {
    const domain = line.trim().toLowerCase();
    if (domain && !domain.startsWith("#")) domains.add(domain);
  }
  return domains;
}

export async function fetchUpstreamBlocklist(): Promise<Set<string>> {
  const res = await fetch(UPSTREAM_BLOCKLIST_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const domains = parseBlocklist(await res.text());
  if (domains.size < MIN_BLOCKLIST_SIZE) {
    throw new Error(`only ${domains.size} domains`);
  }
  return domains;
}

function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Validator for better-auth-harmony. Keeps harmony's default (isEmail +
 * mailchecker), then rejects domains on the disposable-email-domains list,
 * domains that do not exist or refuse mail (null MX), and domains whose MX
 * hosts belong to a disposable provider by name or address. Temp-mail
 * services rotate fresh domains faster than any list updates, but they all
 * deliver to their own servers: dcpa.net and wshu.net both route to
 * in.mail.tm, and temp-mail.org domains all resolve to one IP.
 *
 * Any other DNS or list-fetch failure fails open: an outage must never lock
 * people out of sign-up or sign-in.
 */
export function createEmailValidator({
  resolveMx,
  resolve4,
  fetchBlocklist,
  now = Date.now,
}: {
  resolveMx: ResolveMx;
  resolve4: Resolve4;
  fetchBlocklist?: FetchBlocklist;
  now?: () => number;
}) {
  const cache = new Map<string, CacheEntry>();

  let upstream: Set<string> | null = null;
  let nextRefreshAt = 0;
  let refreshing: Promise<void> | null = null;

  function refreshBlocklist(): Promise<void> {
    if (fetchBlocklist && !refreshing && now() >= nextRefreshAt) {
      refreshing = fetchBlocklist()
        .then(
          (domains) => {
            upstream = domains;
            nextRefreshAt = now() + BLOCKLIST_REFRESH_MS;
          },
          (error) => {
            console.warn("[email-validation] blocklist fetch failed:", error);
            nextRefreshAt = now() + BLOCKLIST_RETRY_MS;
          },
        )
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing ?? Promise.resolve();
  }

  /**
   * The disposable-email-domains list (live, else the package) and our own
   * set. mailchecker is deliberately not consulted for MX hosts: it lists
   * `yandex.net`, which would reject every business domain on Yandex 360.
   */
  function isListedDisposable(host: string): boolean {
    return domainAndParents(host).some(
      (d) =>
        EXTRA_DISPOSABLE_DOMAINS.has(d) ||
        (upstream ? upstream.has(d) : isDisposableEmailDomain(d)),
    );
  }

  async function onDisposableMxIp(hosts: string[]): Promise<boolean> {
    const addresses = await Promise.all(
      hosts.map((host) => resolve4(host).catch(() => [])),
    );
    return addresses.flat().some((ip) => DISPOSABLE_MX_IPS.has(ip));
  }

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
    const ok =
      !nullMx &&
      !hosts.some(isListedDisposable) &&
      !(await onDisposableMxIp(hosts));
    return remember(domain, ok, VERDICT_TTL_MS);
  }

  return async (email: string): Promise<boolean> => {
    if (!validateEmail(email)) return false;

    const pending = refreshBlocklist();
    if (!upstream) {
      await Promise.race([
        pending,
        new Promise((resolve) =>
          setTimeout(resolve, FIRST_LOAD_WAIT_MS).unref(),
        ),
      ]);
    }

    const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
    if (isListedDisposable(domain)) return false;
    return checkMx(domain);
  };
}

const resolver = new Resolver({ timeout: 2000, tries: 2 });

export const validateAuthEmail = createEmailValidator({
  resolveMx: (domain) => resolver.resolveMx(domain),
  resolve4: (host) => resolver.resolve4(host),
  fetchBlocklist: fetchUpstreamBlocklist,
});

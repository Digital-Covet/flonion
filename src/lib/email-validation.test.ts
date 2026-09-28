import type { MxRecord } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import { createEmailValidator, parseBlocklist } from "./email-validation";

const mx = (...hosts: string[]): MxRecord[] =>
  hosts.map((exchange, priority) => ({ exchange, priority }));

const dnsError = (code: string) =>
  Object.assign(new Error(`queryMx ${code}`), { code });

function setup(
  answer: (domain: string) => Promise<MxRecord[]>,
  {
    resolve4 = async () => ["203.0.113.10"],
    fetchBlocklist,
  }: {
    resolve4?: (host: string) => Promise<string[]>;
    fetchBlocklist?: () => Promise<Set<string>>;
  } = {},
) {
  let clock = 1_000_000;
  const resolveMx = vi.fn(answer);
  const fetchSpy = fetchBlocklist ? vi.fn(fetchBlocklist) : undefined;
  const validate = createEmailValidator({
    resolveMx,
    resolve4,
    fetchBlocklist: fetchSpy,
    now: () => clock,
  });
  return {
    validate,
    resolveMx,
    fetchBlocklist: fetchSpy,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("createEmailValidator", () => {
  it("accepts a real domain with a normal MX", async () => {
    const { validate } = setup(async () => mx("gmail-smtp-in.l.google.com"));
    expect(await validate("john@gmail.com")).toBe(true);
  });

  it("rejects mailchecker domains without a DNS lookup", async () => {
    const { validate, resolveMx } = setup(async () => mx("mx.example.com"));
    expect(await validate("a@mailinator.com")).toBe(false);
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it("rejects domains only the second list carries", async () => {
    const { validate, resolveMx } = setup(async () => mx("mx.example.com"));
    expect(await validate("a@10minemail.com")).toBe(false);
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it("rejects subdomains of a listed domain", async () => {
    const { validate } = setup(async () => mx("mx.example.com"));
    expect(await validate("a@x.10minemail.com")).toBe(false);
  });

  it("rejects an unlisted domain whose MX belongs to a disposable provider", async () => {
    // Rotating mail.tm domains like dcpa.net deliver to in.mail.tm.
    const { validate } = setup(async () => mx("in.mail.tm"));
    expect(await validate("a@dcpa.net")).toBe(false);
  });

  it("does not treat mainstream MX providers as disposable", async () => {
    // mailchecker lists yandex.net; MX hosts must not be checked against it.
    const { validate } = setup(async () => mx("mx.yandex.net"));
    expect(await validate("a@business-on-yandex.ru")).toBe(true);
  });

  it("rejects domains that do not exist or refuse mail", async () => {
    const missing = setup(async () => {
      throw dnsError("ENOTFOUND");
    });
    expect(await missing.validate("a@no-such-domain.com")).toBe(false);

    const nullMx = setup(async () => mx(""));
    expect(await nullMx.validate("a@refuses-mail.com")).toBe(false);
  });

  it("fails open on other DNS errors", async () => {
    for (const code of ["ENODATA", "ETIMEOUT", "ESERVFAIL"]) {
      const { validate } = setup(async () => {
        throw dnsError(code);
      });
      expect(await validate("a@example-business.com")).toBe(true);
    }
  });

  it("caches per domain until the entry expires", async () => {
    const { validate, resolveMx, advance } = setup(async () =>
      mx("mx.example.com"),
    );
    await validate("a@example-business.com");
    await validate("b@Example-Business.com");
    expect(resolveMx).toHaveBeenCalledTimes(1);

    advance(60 * 60 * 1000 + 1);
    await validate("a@example-business.com");
    expect(resolveMx).toHaveBeenCalledTimes(2);
  });

  it("retries a fail-open result sooner than a verdict", async () => {
    const { validate, resolveMx, advance } = setup(async () => {
      throw dnsError("ETIMEOUT");
    });
    await validate("a@example-business.com");
    advance(5 * 60 * 1000 + 1);
    await validate("a@example-business.com");
    expect(resolveMx).toHaveBeenCalledTimes(2);
  });

  it("rejects an MX host on a known disposable mail server IP", async () => {
    // temp-mail.org: every rotating domain gets its own mail.<domain> host.
    const { validate } = setup(async () => mx("mail.ncleap.com"), {
      resolve4: async () => ["134.199.178.234"],
    });
    expect(await validate("pixivan341@ncleap.com")).toBe(false);
  });

  it("ignores MX hosts whose address lookup fails", async () => {
    const { validate } = setup(async () => mx("mx.example-business.com"), {
      resolve4: async () => {
        throw dnsError("ETIMEOUT");
      },
    });
    expect(await validate("a@example-business.com")).toBe(true);
  });
});

describe("live blocklist", () => {
  const live = new Set(["fresh-temp.com"]);

  it("rejects domains only the live list carries", async () => {
    const { validate, resolveMx } = setup(async () => mx("mx.example.com"), {
      fetchBlocklist: async () => live,
    });
    expect(await validate("a@fresh-temp.com")).toBe(false);
    expect(await validate("a@sub.fresh-temp.com")).toBe(false);
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it("falls back to the bundled list and retries when the fetch fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validate, fetchBlocklist, advance } = setup(
      async () => mx("mx.example.com"),
      {
        fetchBlocklist: async () => {
          throw new Error("offline");
        },
      },
    );
    expect(await validate("a@10minemail.com")).toBe(false);
    await validate("a@10minemail.com");
    expect(fetchBlocklist).toHaveBeenCalledTimes(1);

    advance(15 * 60 * 1000 + 1);
    await validate("a@10minemail.com");
    expect(fetchBlocklist).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("refetches the list after it goes stale", async () => {
    const { validate, fetchBlocklist, advance } = setup(
      async () => mx("mx.example.com"),
      { fetchBlocklist: async () => live },
    );
    await validate("a@example-business.com");
    await validate("a@example-business.com");
    expect(fetchBlocklist).toHaveBeenCalledTimes(1);

    advance(12 * 60 * 60 * 1000 + 1);
    await validate("a@example-business.com");
    expect(fetchBlocklist).toHaveBeenCalledTimes(2);
  });
});

describe("parseBlocklist", () => {
  it("skips comments and blank lines and handles CRLF", () => {
    expect(parseBlocklist("# header\r\nA.com\r\n\r\nb.com\n")).toEqual(
      new Set(["a.com", "b.com"]),
    );
  });
});

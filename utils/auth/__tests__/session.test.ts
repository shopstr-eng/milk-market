import {
  clearSessionCookie,
  consumeMagicLinkToken,
  countActiveTokensForEmail,
  createMagicLinkSession,
  createMagicLinkToken,
  deleteAllSessionsForEmail,
  deleteSessionByToken,
  fetchSessionByToken,
  isSameOriginRequest,
  listActiveSessionsForEmail,
  pruneMagicLinkArtifacts,
  readSessionCookie,
  recordAuditEvent,
  rotateSession,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/utils/auth/session";

interface QueryCall {
  text: string;
  params: any[];
}

class FakeDb {
  public calls: QueryCall[] = [];
  public tokens: any[] = [];
  public sessions: any[] = [];
  public audit: any[] = [];
  public createdSchema = false;

  async query(text: string, params: any[] = []) {
    this.calls.push({ text, params });
    const t = text.trim();

    if (/^CREATE TABLE/i.test(t) || /CREATE INDEX/i.test(t)) {
      this.createdSchema = true;
      return { rows: [] };
    }

    if (/^INSERT INTO magic_link_tokens/i.test(t)) {
      const [token, email, scope, subscription_id, pubkey, expires_at] = params;
      this.tokens.push({
        token,
        email,
        scope,
        subscription_id,
        pubkey,
        expires_at,
        used: false,
      });
      return { rows: [] };
    }

    if (/^UPDATE magic_link_tokens SET used = TRUE\s+WHERE email/i.test(t)) {
      const [email, scope, sub] = params;
      for (const row of this.tokens) {
        if (
          row.email === email &&
          row.scope === scope &&
          (row.subscription_id ?? "") === (sub ?? "") &&
          !row.used
        ) {
          row.used = true;
        }
      }
      return { rows: [] };
    }

    if (/^UPDATE magic_link_tokens SET used = TRUE WHERE token/i.test(t)) {
      const [token] = params;
      for (const row of this.tokens) if (row.token === token) row.used = true;
      return { rows: [] };
    }

    if (
      /^SELECT email, scope, subscription_id, pubkey, expires_at, used/i.test(t)
    ) {
      const [token] = params;
      const found = this.tokens.find((r) => r.token === token);
      return { rows: found ? [found] : [] };
    }

    if (/^INSERT INTO magic_link_sessions/i.test(t)) {
      const [session_token, email, scope, pubkey, subscription_id, expires_at] =
        params;
      this.sessions.push({
        session_token,
        email,
        scope,
        pubkey,
        subscription_id,
        expires_at,
        created_at: new Date(),
      });
      return { rows: [] };
    }

    if (
      /^SELECT email, scope, pubkey, subscription_id, expires_at\s+FROM magic_link_sessions/i.test(
        t
      )
    ) {
      const [session_token] = params;
      const found = this.sessions.find(
        (r) => r.session_token === session_token
      );
      return { rows: found ? [found] : [] };
    }

    if (/^DELETE FROM magic_link_sessions WHERE session_token/i.test(t)) {
      const [session_token] = params;
      const before = this.sessions.length;
      this.sessions = this.sessions.filter(
        (r) => r.session_token !== session_token
      );
      return { rows: [], rowCount: before - this.sessions.length } as any;
    }

    if (/^DELETE FROM magic_link_sessions WHERE expires_at/i.test(t)) {
      const cutoff = params[0];
      if (!cutoff) return { rows: [], rowCount: 0 } as any;
      const before = this.sessions.length;
      this.sessions = this.sessions.filter(
        (r) => new Date(r.expires_at) >= new Date(cutoff)
      );
      return { rows: [], rowCount: before - this.sessions.length } as any;
    }

    if (/^INSERT INTO magic_link_audit/i.test(t)) {
      const [
        event_type,
        email,
        scope,
        subscription_id,
        ip,
        user_agent,
        success,
        error,
      ] = params;
      this.audit.push({
        event_type,
        email,
        scope,
        subscription_id,
        ip,
        user_agent,
        success,
        error,
      });
      return { rows: [] };
    }

    if (
      /^SELECT session_token, scope, subscription_id, expires_at, created_at/i.test(
        t
      )
    ) {
      const [email] = params;
      const rows = this.sessions
        .filter(
          (s) =>
            (s.email ?? "").toLowerCase() === (email ?? "").toLowerCase() &&
            new Date(s.expires_at) > new Date()
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      return { rows };
    }

    if (
      /^DELETE FROM magic_link_sessions\s+WHERE LOWER\(email\) = LOWER\(\$1\) AND session_token <> \$2/i.test(
        t
      )
    ) {
      const [email, except] = params;
      const before = this.sessions.length;
      this.sessions = this.sessions.filter(
        (s) =>
          !(
            (s.email ?? "").toLowerCase() === (email ?? "").toLowerCase() &&
            s.session_token !== except
          )
      );
      return { rows: [], rowCount: before - this.sessions.length } as any;
    }

    if (/^DELETE FROM magic_link_sessions WHERE LOWER\(email\)/i.test(t)) {
      const [email] = params;
      const before = this.sessions.length;
      this.sessions = this.sessions.filter(
        (s) => (s.email ?? "").toLowerCase() !== (email ?? "").toLowerCase()
      );
      return { rows: [], rowCount: before - this.sessions.length } as any;
    }

    if (/^SELECT COUNT\(\*\)::int AS c FROM magic_link_tokens/i.test(t)) {
      const [email, scope] = params;
      const c = this.tokens.filter(
        (r) =>
          (r.email ?? "").toLowerCase() === (email ?? "").toLowerCase() &&
          r.scope === scope &&
          !r.used &&
          new Date(r.expires_at) > new Date()
      ).length;
      return { rows: [{ c }] };
    }

    if (/^DELETE FROM magic_link_tokens WHERE expires_at/i.test(t)) {
      const cutoff = params[0];
      if (!cutoff) return { rows: [], rowCount: 0 } as any;
      const before = this.tokens.length;
      this.tokens = this.tokens.filter(
        (r) => new Date(r.expires_at) >= new Date(cutoff)
      );
      return { rows: [], rowCount: before - this.tokens.length } as any;
    }

    return { rows: [] };
  }
}

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  } as any;
}

describe("magic-link session helpers", () => {
  it("creates a token, then consumes it once", async () => {
    const db = new FakeDb();
    const token = await createMagicLinkToken(db, {
      email: "alice@example.com",
      scope: "email_session",
      pubkey: "pk1",
    });
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
    expect(db.tokens).toHaveLength(1);

    const consumed = await consumeMagicLinkToken(db, token);
    expect(consumed.email).toBe("alice@example.com");
    expect(consumed.scope).toBe("email_session");
    expect(consumed.pubkey).toBe("pk1");

    await expect(consumeMagicLinkToken(db, token)).rejects.toThrow(/used/i);
  });

  it("rejects expired tokens", async () => {
    const db = new FakeDb();
    const token = await createMagicLinkToken(db, {
      email: "bob@example.com",
      scope: "email_session",
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    await expect(consumeMagicLinkToken(db, token)).rejects.toThrow(/expired/i);
  });

  it("invalidates older unused tokens for the same scope+email", async () => {
    const db = new FakeDb();
    await createMagicLinkToken(db, {
      email: "carol@example.com",
      scope: "email_session",
    });
    await createMagicLinkToken(db, {
      email: "carol@example.com",
      scope: "email_session",
    });
    const unused = db.tokens.filter((t) => !t.used);
    expect(unused).toHaveLength(1);
  });

  it("scopes subscription_session tokens by subscription_id", async () => {
    const db = new FakeDb();
    const a = await createMagicLinkToken(db, {
      email: "d@example.com",
      scope: "subscription_session",
      subscriptionId: "sub_A",
    });
    const b = await createMagicLinkToken(db, {
      email: "d@example.com",
      scope: "subscription_session",
      subscriptionId: "sub_B",
    });
    // Both should remain valid since they target different subscriptions.
    expect(db.tokens.filter((t) => !t.used)).toHaveLength(2);
    const consumedA = await consumeMagicLinkToken(db, a);
    expect(consumedA.subscriptionId).toBe("sub_A");
    const consumedB = await consumeMagicLinkToken(db, b);
    expect(consumedB.subscriptionId).toBe("sub_B");
  });

  it("creates and fetches a session, then deletes it", async () => {
    const db = new FakeDb();
    const { sessionToken } = await createMagicLinkSession(db, {
      email: "e@example.com",
      scope: "email_session",
      pubkey: "pkE",
    });
    const session = await fetchSessionByToken(db, sessionToken);
    expect(session?.email).toBe("e@example.com");
    expect(session?.pubkey).toBe("pkE");

    await deleteSessionByToken(db, sessionToken);
    const after = await fetchSessionByToken(db, sessionToken);
    expect(after).toBeNull();
  });

  it("returns null for expired sessions", async () => {
    const db = new FakeDb();
    const { sessionToken } = await createMagicLinkSession(db, {
      email: "f@example.com",
      scope: "subscription_session",
      subscriptionId: "sub_X",
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    const session = await fetchSessionByToken(db, sessionToken);
    expect(session).toBeNull();
  });

  it("prunes expired sessions and tokens", async () => {
    const db = new FakeDb();
    await createMagicLinkSession(db, {
      email: "g@example.com",
      scope: "email_session",
      ttlMs: 1,
    });
    await createMagicLinkSession(db, {
      email: "g@example.com",
      scope: "email_session",
      ttlMs: 60_000,
    });
    await createMagicLinkToken(db, {
      email: "g@example.com",
      scope: "email_session",
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 10));
    const result = await pruneMagicLinkArtifacts(db, 0);
    expect(result.prunedSessions).toBe(1);
    expect(result.prunedTokens).toBeGreaterThanOrEqual(1);
    expect(db.sessions).toHaveLength(1);
  });

  it("sets and clears the session cookie with HttpOnly + SameSite", () => {
    const res = makeRes();
    setSessionCookie(res, "abc123", 3600);
    const cookie = res.headers["Set-Cookie"];
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=abc123`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=3600");

    clearSessionCookie(res);
    const cleared = res.headers["Set-Cookie"];
    expect(cleared).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cleared).toContain("Max-Age=0");
  });

  it("reads the session cookie from the request header", () => {
    const req: any = {
      headers: {
        cookie: `something=other; ${SESSION_COOKIE_NAME}=tok-xyz; foo=bar`,
      },
    };
    expect(readSessionCookie(req)).toBe("tok-xyz");

    const empty: any = { headers: {} };
    expect(readSessionCookie(empty)).toBeNull();
  });

  it("rotateSession deletes the old token and issues a new one", async () => {
    const db = new FakeDb();
    const old = await createMagicLinkSession(db, {
      email: "Rot@example.com",
      scope: "email_session",
    });
    const next = await rotateSession(db, old.sessionToken);
    expect(next).not.toBeNull();
    expect(next!.sessionToken).not.toBe(old.sessionToken);
    expect(await fetchSessionByToken(db, old.sessionToken)).toBeNull();
    const found = await fetchSessionByToken(db, next!.sessionToken);
    expect(found?.email?.toLowerCase()).toBe("rot@example.com");
  });

  it("rotateSession returns null when the input token is missing", async () => {
    const db = new FakeDb();
    expect(await rotateSession(db, "does-not-exist")).toBeNull();
  });

  it("listActiveSessionsForEmail returns only matching unexpired rows", async () => {
    const db = new FakeDb();
    await createMagicLinkSession(db, {
      email: "L@example.com",
      scope: "email_session",
    });
    await createMagicLinkSession(db, {
      email: "L@example.com",
      scope: "email_session",
    });
    await createMagicLinkSession(db, {
      email: "other@example.com",
      scope: "email_session",
    });
    const list = await listActiveSessionsForEmail(db, "l@example.com");
    expect(list.length).toBe(2);
    expect(list.every((s) => s.scope === "email_session")).toBe(true);
  });

  it("deleteAllSessionsForEmail can preserve a single token", async () => {
    const db = new FakeDb();
    const a = await createMagicLinkSession(db, {
      email: "del@example.com",
      scope: "email_session",
    });
    await createMagicLinkSession(db, {
      email: "del@example.com",
      scope: "email_session",
    });
    await createMagicLinkSession(db, {
      email: "del@example.com",
      scope: "email_session",
    });
    const removed = await deleteAllSessionsForEmail(
      db,
      "del@example.com",
      a.sessionToken
    );
    expect(removed).toBe(2);
    const remaining = await listActiveSessionsForEmail(db, "del@example.com");
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.sessionToken).toBe(a.sessionToken);
  });

  it("countActiveTokensForEmail counts only fresh tokens for the scope", async () => {
    const db = new FakeDb();
    await createMagicLinkToken(db, {
      email: "c@example.com",
      scope: "email_session",
    });
    // Re-issuing for the same email+scope marks the prior token used, so this
    // test relies on the helper counting only the latest unused row.
    await createMagicLinkToken(db, {
      email: "c@example.com",
      scope: "email_session",
    });
    await createMagicLinkToken(db, {
      email: "c@example.com",
      scope: "subscription_session",
      subscriptionId: "sub_1",
    });
    expect(
      await countActiveTokensForEmail(db, "c@example.com", "email_session")
    ).toBe(1);
    expect(
      await countActiveTokensForEmail(
        db,
        "c@example.com",
        "subscription_session"
      )
    ).toBe(1);
    expect(
      await countActiveTokensForEmail(db, "nobody@example.com", "email_session")
    ).toBe(0);
  });

  it("recordAuditEvent writes a row with the supplied fields", async () => {
    const db = new FakeDb();
    await recordAuditEvent(db, {
      eventType: "request_email_link",
      email: "audit@example.com",
      scope: "email_session",
      ip: "1.2.3.4",
      userAgent: "jest",
      success: true,
    });
    expect(db.audit.length).toBe(1);
    expect(db.audit[0]).toMatchObject({
      event_type: "request_email_link",
      email: "audit@example.com",
      scope: "email_session",
      ip: "1.2.3.4",
      user_agent: "jest",
      success: true,
    });
  });

  it("recordAuditEvent never throws when the database fails", async () => {
    const broken: any = {
      query: async () => {
        throw new Error("db down");
      },
    };
    await expect(
      recordAuditEvent(broken, {
        eventType: "verify_email_link",
        success: false,
      })
    ).resolves.toBeUndefined();
  });

  it("isSameOriginRequest accepts matching Origin and rejects mismatches", () => {
    const ok: any = {
      headers: { origin: "https://x.example", host: "x.example" },
    };
    expect(isSameOriginRequest(ok)).toBe(true);

    const bad: any = {
      headers: { origin: "https://evil.example", host: "x.example" },
    };
    expect(isSameOriginRequest(bad)).toBe(false);

    const noOrigin: any = { headers: { host: "x.example" } };
    // No Origin or Referer is treated as untrusted for cookie-auth writes.
    expect(isSameOriginRequest(noOrigin)).toBe(false);

    const refererFallback: any = {
      headers: {
        host: "x.example",
        referer: "https://x.example/some/path",
      },
    };
    expect(isSameOriginRequest(refererFallback)).toBe(true);

    const noHost: any = { headers: { origin: "https://x.example" } };
    expect(isSameOriginRequest(noHost)).toBe(false);
  });
});

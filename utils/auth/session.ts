import type { NextApiRequest, NextApiResponse } from "next";
import type { PoolClient } from "pg";
import { Client, Pool } from "pg";
import { randomBytes } from "crypto";

export const SESSION_COOKIE_NAME = "mm_session";
export const SIGN_IN_LINK_TTL_MS = 60 * 60 * 1000; // 1 hour
export const SIGN_IN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SUBSCRIPTION_LINK_TTL_MS = 60 * 60 * 1000; // 1 hour
export const SUBSCRIPTION_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type MagicLinkScope = "email_session" | "subscription_session";

export interface MagicLinkSession {
  email: string;
  scope: MagicLinkScope;
  pubkey: string | null;
  subscriptionId: string | null;
  expiresAt: Date;
}

interface AnyClient {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
}

let schemaInitialized = false;
async function ensureSchema(client: AnyClient): Promise<void> {
  if (schemaInitialized) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS magic_link_tokens (
      id SERIAL PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      scope VARCHAR(32) NOT NULL CHECK (scope IN ('email_session', 'subscription_session')),
      subscription_id TEXT,
      pubkey VARCHAR(64),
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token ON magic_link_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens(email);

    CREATE TABLE IF NOT EXISTS magic_link_sessions (
      id SERIAL PRIMARY KEY,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      scope VARCHAR(32) NOT NULL CHECK (scope IN ('email_session', 'subscription_session')),
      pubkey VARCHAR(64),
      subscription_id TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_magic_link_sessions_session_token ON magic_link_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_magic_link_sessions_email ON magic_link_sessions(email);

    CREATE TABLE IF NOT EXISTS magic_link_audit (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      email VARCHAR(255),
      scope VARCHAR(32),
      subscription_id TEXT,
      ip VARCHAR(64),
      user_agent TEXT,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_magic_link_audit_email ON magic_link_audit(email);
    CREATE INDEX IF NOT EXISTS idx_magic_link_audit_created_at ON magic_link_audit(created_at);
  `);
  schemaInitialized = true;
}

export interface AuditEventInput {
  eventType: string;
  email?: string | null;
  scope?: MagicLinkScope | null;
  subscriptionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  success?: boolean;
  error?: string | null;
}

/** Best-effort audit log writer. Never throws. */
export async function recordAuditEvent(
  client: AnyClient,
  input: AuditEventInput
): Promise<void> {
  try {
    await ensureSchema(client);
    await client.query(
      `INSERT INTO magic_link_audit
        (event_type, email, scope, subscription_id, ip, user_agent, success, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.eventType,
        input.email ?? null,
        input.scope ?? null,
        input.subscriptionId ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        input.success ?? true,
        input.error ?? null,
      ]
    );
  } catch (err) {
    // Auditing must never block the request flow.
    console.error("recordAuditEvent failed:", err);
  }
}

export function getRequestIp(req: NextApiRequest): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  return req.socket?.remoteAddress ?? null;
}

export function getRequestUserAgent(req: NextApiRequest): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 500) : null;
}

function randomToken(length = 64): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i]! % chars.length];
  }
  return out;
}

export interface CreateMagicLinkInput {
  email: string;
  scope: MagicLinkScope;
  pubkey?: string | null;
  subscriptionId?: string | null;
  ttlMs?: number;
}

/** Creates a magic-link token and writes it to the DB. Returns the raw token. */
export async function createMagicLinkToken(
  client: AnyClient,
  input: CreateMagicLinkInput
): Promise<string> {
  await ensureSchema(client);
  const ttl =
    input.ttlMs ??
    (input.scope === "subscription_session"
      ? SUBSCRIPTION_LINK_TTL_MS
      : SIGN_IN_LINK_TTL_MS);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ttl);

  // Invalidate previous unused tokens of the same scope/email/sub.
  await client.query(
    `UPDATE magic_link_tokens SET used = TRUE
     WHERE email = $1 AND scope = $2
       AND COALESCE(subscription_id, '') = COALESCE($3, '')
       AND used = FALSE`,
    [input.email, input.scope, input.subscriptionId ?? null]
  );

  await client.query(
    `INSERT INTO magic_link_tokens (token, email, scope, subscription_id, pubkey, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      token,
      input.email,
      input.scope,
      input.subscriptionId ?? null,
      input.pubkey ?? null,
      expiresAt,
    ]
  );

  // Best-effort cleanup of expired rows.
  await client.query(
    `DELETE FROM magic_link_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`
  );

  return token;
}

export interface ConsumedToken {
  email: string;
  scope: MagicLinkScope;
  pubkey: string | null;
  subscriptionId: string | null;
}

/**
 * Validates and consumes a magic-link token. Returns its details on success
 * and marks it used. Throws on invalid/expired/used tokens.
 */
export async function consumeMagicLinkToken(
  client: AnyClient,
  token: string
): Promise<ConsumedToken> {
  await ensureSchema(client);
  const result = await client.query(
    `SELECT email, scope, subscription_id, pubkey, expires_at, used
       FROM magic_link_tokens WHERE token = $1`,
    [token]
  );
  if (result.rows.length === 0) {
    throw new Error("Invalid magic link token");
  }
  const row = result.rows[0];
  if (row.used) throw new Error("This magic link has already been used");
  if (new Date(row.expires_at) < new Date()) {
    throw new Error("This magic link has expired");
  }
  await client.query(
    `UPDATE magic_link_tokens SET used = TRUE WHERE token = $1`,
    [token]
  );
  return {
    email: row.email,
    scope: row.scope as MagicLinkScope,
    pubkey: row.pubkey ?? null,
    subscriptionId: row.subscription_id ?? null,
  };
}

export interface CreateSessionInput {
  email: string;
  scope: MagicLinkScope;
  pubkey?: string | null;
  subscriptionId?: string | null;
  ttlMs?: number;
}

/** Creates a new session row and returns its session_token. */
export async function createMagicLinkSession(
  client: AnyClient,
  input: CreateSessionInput
): Promise<{ sessionToken: string; expiresAt: Date }> {
  await ensureSchema(client);
  const ttl =
    input.ttlMs ??
    (input.scope === "subscription_session"
      ? SUBSCRIPTION_SESSION_TTL_MS
      : SIGN_IN_SESSION_TTL_MS);
  const sessionToken = randomToken();
  const expiresAt = new Date(Date.now() + ttl);

  await client.query(
    `INSERT INTO magic_link_sessions (session_token, email, scope, pubkey, subscription_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sessionToken,
      input.email,
      input.scope,
      input.pubkey ?? null,
      input.subscriptionId ?? null,
      expiresAt,
    ]
  );
  return { sessionToken, expiresAt };
}

/** Fetches a session by its token if still valid. */
export async function fetchSessionByToken(
  client: AnyClient,
  sessionToken: string
): Promise<MagicLinkSession | null> {
  await ensureSchema(client);
  const result = await client.query(
    `SELECT email, scope, pubkey, subscription_id, expires_at
       FROM magic_link_sessions WHERE session_token = $1`,
    [sessionToken]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const expiresAt = new Date(row.expires_at);
  if (expiresAt < new Date()) return null;
  return {
    email: row.email,
    scope: row.scope as MagicLinkScope,
    pubkey: row.pubkey ?? null,
    subscriptionId: row.subscription_id ?? null,
    expiresAt,
  };
}

export async function deleteSessionByToken(
  client: AnyClient,
  sessionToken: string
): Promise<void> {
  await ensureSchema(client);
  await client.query(
    `DELETE FROM magic_link_sessions WHERE session_token = $1`,
    [sessionToken]
  );
}

/**
 * Issues a fresh session_token that inherits the existing session's
 * email/scope/pubkey/subscription/expiry, then deletes the old row. Used after
 * sensitive writes (cancel/update subscription) to limit replay damage if the
 * cookie is ever leaked.
 */
export async function rotateSession(
  client: AnyClient,
  oldSessionToken: string
): Promise<{ sessionToken: string; expiresAt: Date } | null> {
  await ensureSchema(client);
  const session = await fetchSessionByToken(client, oldSessionToken);
  if (!session) return null;
  const newToken = randomToken();
  await client.query(
    `INSERT INTO magic_link_sessions (session_token, email, scope, pubkey, subscription_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      newToken,
      session.email,
      session.scope,
      session.pubkey,
      session.subscriptionId,
      session.expiresAt,
    ]
  );
  await client.query(
    `DELETE FROM magic_link_sessions WHERE session_token = $1`,
    [oldSessionToken]
  );
  return { sessionToken: newToken, expiresAt: session.expiresAt };
}

export interface ActiveSessionRow {
  sessionToken: string;
  scope: MagicLinkScope;
  subscriptionId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

/** Returns all live (unexpired) sessions for a given email, newest first. */
export async function listActiveSessionsForEmail(
  client: AnyClient,
  email: string
): Promise<ActiveSessionRow[]> {
  await ensureSchema(client);
  const result = await client.query(
    `SELECT session_token, scope, subscription_id, expires_at, created_at
       FROM magic_link_sessions
       WHERE LOWER(email) = LOWER($1) AND expires_at > NOW()
       ORDER BY created_at DESC`,
    [email]
  );
  return result.rows.map((r: any) => ({
    sessionToken: r.session_token,
    scope: r.scope as MagicLinkScope,
    subscriptionId: r.subscription_id ?? null,
    expiresAt: new Date(r.expires_at),
    createdAt: new Date(r.created_at),
  }));
}

/**
 * Deletes every session for an email except (optionally) the one being kept.
 * Returns the number of rows removed.
 */
export async function deleteAllSessionsForEmail(
  client: AnyClient,
  email: string,
  exceptSessionToken?: string
): Promise<number> {
  await ensureSchema(client);
  const result: any = exceptSessionToken
    ? await client.query(
        `DELETE FROM magic_link_sessions
           WHERE LOWER(email) = LOWER($1) AND session_token <> $2`,
        [email, exceptSessionToken]
      )
    : await client.query(
        `DELETE FROM magic_link_sessions WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
  return result?.rowCount ?? 0;
}

/**
 * Counts unused, unexpired tokens already issued for a given email+scope.
 * Used to throttle per-recipient before issuing another magic link.
 */
export async function countActiveTokensForEmail(
  client: AnyClient,
  email: string,
  scope: MagicLinkScope
): Promise<number> {
  await ensureSchema(client);
  const result = await client.query(
    `SELECT COUNT(*)::int AS c FROM magic_link_tokens
       WHERE LOWER(email) = LOWER($1)
         AND scope = $2
         AND used = FALSE
         AND expires_at > NOW()`,
    [email, scope]
  );
  return result.rows[0]?.c ?? 0;
}

/**
 * Deletes magic-link sessions and tokens whose expiry is older than `maxAgeMs`
 * past the current time. Returns the row counts removed from each table.
 * Intended to be invoked by the periodic cron-cleanup endpoint.
 */
export async function pruneMagicLinkArtifacts(
  client: AnyClient,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<{ prunedSessions: number; prunedTokens: number }> {
  await ensureSchema(client);
  const cutoff = new Date(Date.now() - maxAgeMs);
  const sessionsResult: any = await client.query(
    `DELETE FROM magic_link_sessions WHERE expires_at < $1`,
    [cutoff]
  );
  const tokensResult: any = await client.query(
    `DELETE FROM magic_link_tokens WHERE expires_at < $1`,
    [cutoff]
  );
  return {
    prunedSessions: sessionsResult?.rowCount ?? 0,
    prunedTokens: tokensResult?.rowCount ?? 0,
  };
}

// ---------- Cookie helpers ----------

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function readSessionCookie(req: NextApiRequest): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

export function setSessionCookie(
  res: NextApiResponse,
  sessionToken: string,
  maxAgeSeconds: number
): void {
  const isProd = process.env.NODE_ENV === "production";
  // SameSite=Strict on this cookie because every flow that sets it is a
  // first-party POST submitted via fetch from our own origin (verify endpoints,
  // signout, rotation). The cross-site nav use case (clicking a link in an
  // email) is the link-consumption page itself, which then POSTs to our verify
  // endpoint same-origin — so Strict does not break the flow.
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: NextApiResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/**
 * CSRF defense for cookie-authenticated state-changing endpoints. Verifies
 * that the request's Origin (or Referer, as a fallback) matches the request's
 * own host. Returns true if the request looks first-party, false otherwise.
 *
 * Same-origin requests via fetch always include Origin; cross-site form posts
 * either lack Origin (older browsers) or have a different one. Combined with
 * SameSite=Strict on the cookie this is defense in depth.
 */
export function isSameOriginRequest(req: NextApiRequest): boolean {
  const host = req.headers.host;
  if (!host) return false;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const sourceUrl = origin || referer;
  if (!sourceUrl) {
    // No Origin or Referer — only safe in trusted server-to-server contexts,
    // which don't apply to user-facing cookie auth. Reject.
    return false;
  }
  try {
    const parsed = new URL(sourceUrl);
    return parsed.host === host;
  } catch {
    return false;
  }
}

/**
 * Convenience: open a fresh PG client. Caller is responsible for `await client.end()`.
 * Mirrors the pattern used across pages/api/auth/*.
 */
export function newAuthDbClient(): Client {
  return new Client({ connectionString: process.env["DATABASE_URL"] });
}

/** Lookup the session for the request. Returns null if missing/expired. */
export async function getActiveSession(
  req: NextApiRequest,
  client: AnyClient
): Promise<MagicLinkSession | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  return fetchSessionByToken(client, token);
}

// Helper signatures so callers don't have to import pg types.
export type { Client as PgClient, Pool as PgPool, PoolClient };

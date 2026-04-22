import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimit } from "@/utils/rate-limit";
import {
  consumeMagicLinkToken,
  createMagicLinkSession,
  getRequestIp,
  getRequestUserAgent,
  newAuthDbClient,
  recordAuditEvent,
  setSessionCookie,
  SIGN_IN_SESSION_TTL_MS,
} from "@/utils/auth/session";

const RATE_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!applyRateLimit(req, res, "verify-email-link", RATE_LIMIT)) return;

  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  const ip = getRequestIp(req);
  const ua = getRequestUserAgent(req);
  const client = newAuthDbClient();
  try {
    await client.connect();
    let consumed;
    try {
      consumed = await consumeMagicLinkToken(client, token);
    } catch (err) {
      await recordAuditEvent(client, {
        eventType: "verify_email_link_failed",
        ip,
        userAgent: ua,
        success: false,
        error: err instanceof Error ? err.message : "consume failed",
      });
      throw err;
    }
    if (consumed.scope !== "email_session") {
      await recordAuditEvent(client, {
        eventType: "verify_email_link_wrong_scope",
        email: consumed.email,
        scope: consumed.scope,
        ip,
        userAgent: ua,
        success: false,
        error: "wrong scope",
      });
      return res.status(400).json({
        error:
          "This link is not a sign-in link. Please use the original link from your email.",
      });
    }

    let authType: string | null = null;
    const recoveryRow = await client.query(
      `SELECT auth_type FROM account_recovery WHERE email = $1 LIMIT 1`,
      [consumed.email]
    );
    if (recoveryRow.rows.length > 0) {
      authType = recoveryRow.rows[0].auth_type;
    }

    const { sessionToken } = await createMagicLinkSession(client, {
      email: consumed.email,
      scope: "email_session",
      pubkey: consumed.pubkey,
    });

    setSessionCookie(
      res,
      sessionToken,
      Math.floor(SIGN_IN_SESSION_TTL_MS / 1000)
    );

    await recordAuditEvent(client, {
      eventType: "verify_email_link_success",
      email: consumed.email,
      scope: "email_session",
      ip,
      userAgent: ua,
      success: true,
    });

    return res.status(200).json({
      success: true,
      email: consumed.email,
      pubkey: consumed.pubkey,
      authType,
    });
  } catch (error) {
    console.error("verify-email-link error:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to verify magic link";
    return res.status(400).json({ error: msg });
  } finally {
    await client.end();
  }
}

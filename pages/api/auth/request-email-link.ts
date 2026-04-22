import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimit } from "@/utils/rate-limit";
import {
  countActiveTokensForEmail,
  createMagicLinkToken,
  getRequestIp,
  getRequestUserAgent,
  newAuthDbClient,
  recordAuditEvent,
} from "@/utils/auth/session";
import { sendSignInMagicLinkEmail } from "@/utils/email/email-service";

const RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const PER_EMAIL_LIMIT = 3; // max unused, unexpired tokens per address
const MIN_RESPONSE_MS = 600; // constant-time floor to dampen enumeration timing

function genericResponse(res: NextApiResponse) {
  return res.status(200).json({
    success: true,
    message:
      "If an account exists with this email, a sign-in link has been sent.",
  });
}

async function withMinDelay<T>(work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise((r) => setTimeout(r, MIN_RESPONSE_MS)),
  ]);
  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!applyRateLimit(req, res, "request-email-link", RATE_LIMIT)) return;

  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const ip = getRequestIp(req);
  const ua = getRequestUserAgent(req);

  const work = (async () => {
    const client = newAuthDbClient();
    try {
      await client.connect();

      // Per-email throttle: refuse to flood an inbox even from rotated IPs.
      const activeTokens = await countActiveTokensForEmail(
        client,
        normalizedEmail,
        "email_session"
      );
      if (activeTokens >= PER_EMAIL_LIMIT) {
        await recordAuditEvent(client, {
          eventType: "request_email_link_throttled",
          email: normalizedEmail,
          scope: "email_session",
          ip,
          userAgent: ua,
          success: false,
          error: "per-email throttle",
        });
        return; // generic response; caller never sees the throttle
      }

      // Look up the account_recovery row to determine if this email has any
      // associated account. We don't leak existence in the response.
      const result = await client.query(
        `SELECT pubkey FROM account_recovery WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );

      if (result.rows.length === 0) {
        await recordAuditEvent(client, {
          eventType: "request_email_link_no_account",
          email: normalizedEmail,
          scope: "email_session",
          ip,
          userAgent: ua,
          success: true,
        });
        return;
      }
      const { pubkey } = result.rows[0];

      const token = await createMagicLinkToken(client, {
        email: normalizedEmail,
        scope: "email_session",
        pubkey,
      });

      const baseUrl =
        process.env["NEXTAUTH_URL"] ||
        (req.headers.host
          ? `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`
          : "");
      const signInLink = `${baseUrl}/auth/sign-in-link?token=${token}`;

      try {
        await sendSignInMagicLinkEmail(normalizedEmail, signInLink);
        await recordAuditEvent(client, {
          eventType: "request_email_link_sent",
          email: normalizedEmail,
          scope: "email_session",
          ip,
          userAgent: ua,
          success: true,
        });
      } catch (sendErr) {
        await recordAuditEvent(client, {
          eventType: "request_email_link_send_failed",
          email: normalizedEmail,
          scope: "email_session",
          ip,
          userAgent: ua,
          success: false,
          error: sendErr instanceof Error ? sendErr.message : "send failed",
        });
        throw sendErr;
      }
    } catch (error) {
      console.error("request-email-link error:", error);
    } finally {
      await client.end();
    }
  })();

  await withMinDelay(work);
  return genericResponse(res);
}

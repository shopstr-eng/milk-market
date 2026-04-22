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
  SUBSCRIPTION_SESSION_TTL_MS,
} from "@/utils/auth/session";

const RATE_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!applyRateLimit(req, res, "subscriptions-verify-magic-link", RATE_LIMIT))
    return;

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
        eventType: "verify_subscription_link_failed",
        ip,
        userAgent: ua,
        success: false,
        error: err instanceof Error ? err.message : "consume failed",
      });
      throw err;
    }
    if (consumed.scope !== "subscription_session" || !consumed.subscriptionId) {
      await recordAuditEvent(client, {
        eventType: "verify_subscription_link_wrong_scope",
        email: consumed.email,
        scope: consumed.scope,
        subscriptionId: consumed.subscriptionId,
        ip,
        userAgent: ua,
        success: false,
        error: "wrong scope or missing subscription_id",
      });
      return res.status(400).json({
        error:
          "This link is not a subscription management link. Please use the link from your email.",
      });
    }

    const { sessionToken, expiresAt } = await createMagicLinkSession(client, {
      email: consumed.email,
      scope: "subscription_session",
      subscriptionId: consumed.subscriptionId,
    });

    setSessionCookie(
      res,
      sessionToken,
      Math.floor(SUBSCRIPTION_SESSION_TTL_MS / 1000)
    );

    await recordAuditEvent(client, {
      eventType: "verify_subscription_link_success",
      email: consumed.email,
      scope: "subscription_session",
      subscriptionId: consumed.subscriptionId,
      ip,
      userAgent: ua,
      success: true,
    });

    return res.status(200).json({
      success: true,
      email: consumed.email,
      subscriptionId: consumed.subscriptionId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("subscriptions/verify-magic-link error:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to verify magic link";
    return res.status(400).json({ error: msg });
  } finally {
    await client.end();
  }
}

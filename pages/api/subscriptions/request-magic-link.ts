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
import { sendSubscriptionMagicLinkEmail } from "@/utils/email/email-service";

const RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const PER_EMAIL_LIMIT = 3;
const MIN_RESPONSE_MS = 600;

function genericResponse(res: NextApiResponse) {
  return res.status(200).json({
    success: true,
    message:
      "If a subscription exists with this email, a management link has been sent.",
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
  if (!applyRateLimit(req, res, "subscriptions-request-magic-link", RATE_LIMIT))
    return;

  const { email, subscriptionId } = req.body || {};
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

      const activeTokens = await countActiveTokensForEmail(
        client,
        normalizedEmail,
        "subscription_session"
      );
      if (activeTokens >= PER_EMAIL_LIMIT) {
        await recordAuditEvent(client, {
          eventType: "request_subscription_link_throttled",
          email: normalizedEmail,
          scope: "subscription_session",
          subscriptionId:
            typeof subscriptionId === "string" ? subscriptionId : null,
          ip,
          userAgent: ua,
          success: false,
          error: "per-email throttle",
        });
        return;
      }

      const params: any[] = [normalizedEmail];
      let where = `LOWER(buyer_email) = $1`;
      if (subscriptionId && typeof subscriptionId === "string") {
        where += ` AND stripe_subscription_id = $2`;
        params.push(subscriptionId);
      }
      const result = await client.query(
        `SELECT stripe_subscription_id, product_event_id
         FROM subscriptions
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT 1`,
        params
      );

      if (result.rows.length === 0) {
        await recordAuditEvent(client, {
          eventType: "request_subscription_link_no_match",
          email: normalizedEmail,
          scope: "subscription_session",
          subscriptionId:
            typeof subscriptionId === "string" ? subscriptionId : null,
          ip,
          userAgent: ua,
          success: true,
        });
        return;
      }

      const targetSubId = result.rows[0].stripe_subscription_id;

      const token = await createMagicLinkToken(client, {
        email: normalizedEmail,
        scope: "subscription_session",
        subscriptionId: targetSubId,
      });

      const baseUrl =
        process.env["NEXTAUTH_URL"] ||
        (req.headers.host
          ? `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`
          : "");
      const manageLink = `${baseUrl}/subscriptions/manage?token=${token}`;

      try {
        await sendSubscriptionMagicLinkEmail(normalizedEmail, manageLink, null);
        await recordAuditEvent(client, {
          eventType: "request_subscription_link_sent",
          email: normalizedEmail,
          scope: "subscription_session",
          subscriptionId: targetSubId,
          ip,
          userAgent: ua,
          success: true,
        });
      } catch (sendErr) {
        await recordAuditEvent(client, {
          eventType: "request_subscription_link_send_failed",
          email: normalizedEmail,
          scope: "subscription_session",
          subscriptionId: targetSubId,
          ip,
          userAgent: ua,
          success: false,
          error: sendErr instanceof Error ? sendErr.message : "send failed",
        });
        throw sendErr;
      }
    } catch (error) {
      console.error("subscriptions/request-magic-link error:", error);
    } finally {
      await client.end();
    }
  })();

  await withMinDelay(work);
  return genericResponse(res);
}

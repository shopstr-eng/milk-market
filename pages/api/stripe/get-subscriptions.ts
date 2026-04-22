import type { NextApiRequest, NextApiResponse } from "next";
import {
  getSubscriptionsByBuyerPubkey,
  getSubscriptionsByBuyerEmail,
  getSubscriptionByStripeId,
} from "@/utils/db/db-service";
import { applyRateLimit } from "@/utils/rate-limit";
import { getActiveSession, newAuthDbClient } from "@/utils/auth/session";

// Rate limit: per-IP cap to bound abuse of payment endpoints.
const RATE_LIMIT = { limit: 120, windowMs: 60000 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!applyRateLimit(req, res, "stripe-get-subscriptions", RATE_LIMIT)) return;

  try {
    const { pubkey, email } = req.query;

    let subscriptions: any[] = [];

    if (pubkey && typeof pubkey === "string") {
      subscriptions = await getSubscriptionsByBuyerPubkey(pubkey);
    } else if (email && typeof email === "string") {
      subscriptions = await getSubscriptionsByBuyerEmail(email);
    } else {
      // Fall back to magic-link session cookie if no query identifier was
      // provided. This is how guest subscription-management pages fetch
      // their data without exposing the buyer's email in the URL.
      const authClient = newAuthDbClient();
      try {
        await authClient.connect();
        const session = await getActiveSession(req, authClient);
        if (!session) {
          return res
            .status(400)
            .json({
              error: "Either pubkey or email query parameter is required",
            });
        }
        if (
          session.scope === "subscription_session" &&
          session.subscriptionId
        ) {
          const one = await getSubscriptionByStripeId(session.subscriptionId);
          subscriptions = one ? [one] : [];
        } else {
          subscriptions = await getSubscriptionsByBuyerEmail(session.email);
        }
      } finally {
        await authClient.end();
      }
    }

    return res.status(200).json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);
    return res.status(500).json({
      error: "Failed to fetch subscriptions",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

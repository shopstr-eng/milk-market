import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import {
  getSubscriptionByStripeId,
  updateSubscriptionShippingAddress,
  updateSubscriptionBillingDate,
} from "@/utils/db/db-service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-09-30.clover",
});
import { applyRateLimit } from "@/utils/rate-limit";
import {
  buildUpdateSubscriptionProof,
  extractSignedEventFromRequest,
  verifySignedHttpRequestProof,
} from "@/utils/nostr/request-auth";
import {
  SIGN_IN_SESSION_TTL_MS,
  SUBSCRIPTION_SESSION_TTL_MS,
  getActiveSession,
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
  newAuthDbClient,
  readSessionCookie,
  recordAuditEvent,
  rotateSession,
  setSessionCookie,
} from "@/utils/auth/session";

// Rate limit: per-IP cap to bound abuse of payment endpoints.
const RATE_LIMIT = { limit: 30, windowMs: 60000 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!applyRateLimit(req, res, "stripe-update-subscription", RATE_LIMIT))
    return;

  try {
    const {
      subscriptionId,
      connectedAccountId,
      shippingAddress,
      nextBillingDate,
    } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required" });
    }

    const dbSubscription = await getSubscriptionByStripeId(subscriptionId);
    if (!dbSubscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const sub = dbSubscription as any;
    const signedEvent = extractSignedEventFromRequest(req);
    const ip = getRequestIp(req);
    const ua = getRequestUserAgent(req);
    let usedCookieAuth = false;
    let auditEmail: string | null = null;

    if (signedEvent) {
      const verification = verifySignedHttpRequestProof(
        signedEvent,
        buildUpdateSubscriptionProof({
          pubkey: signedEvent.pubkey,
          subscriptionId,
        })
      );
      if (!verification.ok) {
        return res
          .status(verification.status)
          .json({ error: verification.error });
      }
      const callerPubkey = signedEvent.pubkey;
      if (
        callerPubkey !== sub.seller_pubkey &&
        callerPubkey !== sub.buyer_pubkey
      ) {
        return res
          .status(403)
          .json({ error: "You do not own this subscription" });
      }
    } else {
      // Fallback: magic-link session cookie. CSRF check first as defense in
      // depth alongside SameSite=Strict on the cookie itself.
      if (!isSameOriginRequest(req)) {
        return res.status(403).json({ error: "Cross-site request blocked" });
      }
      const authClient = newAuthDbClient();
      try {
        await authClient.connect();
        const session = await getActiveSession(req, authClient);
        if (!session) {
          return res.status(401).json({ error: "Authentication required" });
        }
        if (session.scope === "subscription_session") {
          if (session.subscriptionId !== subscriptionId) {
            await recordAuditEvent(authClient, {
              eventType: "update_subscription_denied",
              email: session.email,
              scope: session.scope,
              subscriptionId,
              ip,
              userAgent: ua,
              success: false,
              error: "scope mismatch",
            });
            return res
              .status(403)
              .json({
                error: "This session does not authorize that subscription",
              });
          }
        } else {
          const buyerEmail: string | null = sub.buyer_email ?? null;
          if (
            !buyerEmail ||
            buyerEmail.toLowerCase() !== session.email.toLowerCase()
          ) {
            await recordAuditEvent(authClient, {
              eventType: "update_subscription_denied",
              email: session.email,
              scope: session.scope,
              subscriptionId,
              ip,
              userAgent: ua,
              success: false,
              error: "buyer email mismatch",
            });
            return res
              .status(403)
              .json({ error: "You do not own this subscription" });
          }
        }
        usedCookieAuth = true;
        auditEmail = session.email;
      } finally {
        await authClient.end();
      }
    }

    const stripeOptions = connectedAccountId
      ? { stripeAccount: connectedAccountId }
      : undefined;

    if (shippingAddress) {
      await updateSubscriptionShippingAddress(subscriptionId, shippingAddress);
    }

    if (nextBillingDate) {
      const billingTimestamp = Math.floor(
        new Date(nextBillingDate).getTime() / 1000
      );

      await stripe.subscriptions.update(
        subscriptionId,
        { trial_end: billingTimestamp, proration_behavior: "none" },
        stripeOptions
      );

      const billingDate = new Date(nextBillingDate);
      await updateSubscriptionBillingDate(
        subscriptionId,
        billingDate,
        billingDate
      );
    }

    const updatedSubscription = (await stripe.subscriptions.retrieve(
      subscriptionId,
      stripeOptions
    )) as any;

    if (usedCookieAuth) {
      const oldToken = readSessionCookie(req);
      if (oldToken) {
        const rotateClient = newAuthDbClient();
        try {
          await rotateClient.connect();
          const rotated = await rotateSession(rotateClient, oldToken);
          if (rotated) {
            const ttlSeconds =
              rotated.expiresAt.getTime() - Date.now() >
              SUBSCRIPTION_SESSION_TTL_MS
                ? Math.floor(SIGN_IN_SESSION_TTL_MS / 1000)
                : Math.max(
                    1,
                    Math.floor(
                      (rotated.expiresAt.getTime() - Date.now()) / 1000
                    )
                  );
            setSessionCookie(res, rotated.sessionToken, ttlSeconds);
          }
          await recordAuditEvent(rotateClient, {
            eventType: "update_subscription_success",
            email: auditEmail,
            subscriptionId,
            ip,
            userAgent: ua,
            success: true,
          });
        } finally {
          await rotateClient.end();
        }
      }
    }

    return res.status(200).json({
      success: true,
      subscriptionId: updatedSubscription.id,
      status: updatedSubscription.status,
      currentPeriodEnd: updatedSubscription.current_period_end,
    });
  } catch (error) {
    console.error("Stripe subscription update error:", error);
    return res.status(500).json({
      error: "Failed to update subscription",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { pruneStripeProcessedEvents } from "@/utils/stripe/processed-events";
import { pruneStripePendingPayments } from "@/utils/stripe/pending-payments";
import { applyRateLimit } from "@/utils/rate-limit";
import { newAuthDbClient, pruneMagicLinkArtifacts } from "@/utils/auth/session";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !applyRateLimit(req, res, "stripe-cron-cleanup", {
      limit: 5,
      windowMs: 60_000,
    })
  )
    return;

  const secret = req.headers["x-flow-processor-secret"] || req.body?.secret;
  const expectedSecret = process.env.FLOW_PROCESSOR_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const processedEventsMaxAgeDays = Math.max(
    parseInt(req.body?.processed_events_max_age_days) || 45,
    7
  );
  const pendingPaymentsMaxAgeDays = Math.max(
    parseInt(req.body?.pending_payments_max_age_days) || 30,
    7
  );
  // Clamp to [1, 30] days. Anything beyond that defeats the point of the
  // single-use, short-lived token model and silently keeps stale rows.
  const requestedMagicLinkDays =
    parseInt(req.body?.magic_link_max_age_days) || 1;
  const magicLinkMaxAgeDays = Math.min(Math.max(requestedMagicLinkDays, 1), 30);
  if (requestedMagicLinkDays !== magicLinkMaxAgeDays) {
    console.warn(
      `cron-cleanup: magic_link_max_age_days=${requestedMagicLinkDays} clamped to ${magicLinkMaxAgeDays}`
    );
  }

  try {
    const authClient = newAuthDbClient();
    let magicLinkResult = { prunedSessions: 0, prunedTokens: 0 };
    try {
      await authClient.connect();
      magicLinkResult = await pruneMagicLinkArtifacts(
        authClient,
        magicLinkMaxAgeDays * DAY_MS
      );
    } finally {
      await authClient.end();
    }

    const [prunedEvents, prunedPendingPayments] = await Promise.all([
      pruneStripeProcessedEvents(processedEventsMaxAgeDays * DAY_MS),
      pruneStripePendingPayments(pendingPaymentsMaxAgeDays * DAY_MS),
    ]);

    return res.status(200).json({
      prunedEvents,
      prunedPendingPayments,
      prunedMagicLinkSessions: magicLinkResult.prunedSessions,
      prunedMagicLinkTokens: magicLinkResult.prunedTokens,
      processedEventsMaxAgeDays,
      pendingPaymentsMaxAgeDays,
      magicLinkMaxAgeDays,
    });
  } catch (error) {
    console.error("stripe cron-cleanup failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Cleanup failed",
    });
  }
}

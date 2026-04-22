import type { NextApiRequest, NextApiResponse } from "next";
import {
  deleteAllSessionsForEmail,
  getActiveSession,
  getRequestIp,
  getRequestUserAgent,
  isSameOriginRequest,
  listActiveSessionsForEmail,
  newAuthDbClient,
  readSessionCookie,
  recordAuditEvent,
} from "@/utils/auth/session";

/**
 * GET  -> list every live session belonging to the cookie holder's email,
 *         flagging which one is the current request's session.
 * DELETE -> revoke every other session for this email (keep the current one).
 *
 * Both require an authenticated cookie. DELETE additionally requires the
 * request to be same-origin for CSRF protection.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const currentToken = readSessionCookie(req);
  if (!currentToken) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const client = newAuthDbClient();
  try {
    await client.connect();
    const session = await getActiveSession(req, client);
    if (!session) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.method === "GET") {
      const rows = await listActiveSessionsForEmail(client, session.email);
      return res.status(200).json({
        email: session.email,
        sessions: rows.map((r) => ({
          // Never return raw session_token; expose only an opaque id (last
          // 8 chars are non-sensitive enough for a UI label).
          id: r.sessionToken.slice(-8),
          isCurrent: r.sessionToken === currentToken,
          scope: r.scope,
          subscriptionId: r.subscriptionId,
          expiresAt: r.expiresAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }

    // DELETE
    if (!isSameOriginRequest(req)) {
      return res.status(403).json({ error: "Cross-site request blocked" });
    }
    const removed = await deleteAllSessionsForEmail(
      client,
      session.email,
      currentToken
    );
    await recordAuditEvent(client, {
      eventType: "sessions_revoked_other",
      email: session.email,
      scope: session.scope,
      ip: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
      success: true,
    });
    return res.status(200).json({ success: true, removed });
  } catch (error) {
    console.error("sessions endpoint error:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.end();
  }
}

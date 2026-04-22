import type { NextApiRequest, NextApiResponse } from "next";
import { getActiveSession, newAuthDbClient } from "@/utils/auth/session";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = newAuthDbClient();
  try {
    await client.connect();
    const session = await getActiveSession(req, client);
    if (!session) {
      return res.status(200).json({ authenticated: false });
    }
    return res.status(200).json({
      authenticated: true,
      email: session.email,
      pubkey: session.pubkey,
      scope: session.scope,
      subscriptionId: session.subscriptionId,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("session lookup error:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.end();
  }
}

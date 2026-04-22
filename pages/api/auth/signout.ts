import type { NextApiRequest, NextApiResponse } from "next";
import {
  clearSessionCookie,
  deleteSessionByToken,
  newAuthDbClient,
  readSessionCookie,
} from "@/utils/auth/session";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionToken = readSessionCookie(req);
  clearSessionCookie(res);

  if (sessionToken) {
    const client = newAuthDbClient();
    try {
      await client.connect();
      await deleteSessionByToken(client, sessionToken);
    } catch (error) {
      console.error("signout error:", error);
    } finally {
      await client.end();
    }
  }

  return res.status(200).json({ success: true });
}

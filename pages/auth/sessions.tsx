import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@heroui/react";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";

interface SessionRow {
  id: string;
  isCurrent: boolean;
  scope: "email_session" | "subscription_session";
  subscriptionId: string | null;
  expiresAt: string;
  createdAt: string;
}

export default function ActiveSessionsPage() {
  const router = useRouter();
  const { emailSession, signOutEmailSession } = useContext(SignerContext);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/sessions", {
        credentials: "include",
      });
      if (res.status === 401) {
        setSessions(null);
        setError("You are not signed in with an email link.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load sessions.");
        return;
      }
      setSessions(data.sessions || []);
    } catch {
      setError("Something went wrong loading sessions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevokeOthers = async () => {
    if (!confirm("Sign out of every other device and link?")) return;
    setIsRevoking(true);
    setRevokeMessage("");
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setRevokeMessage(data.error || "Failed to revoke sessions.");
        return;
      }
      setRevokeMessage(
        `Revoked ${data.removed} other session${data.removed === 1 ? "" : "s"}.`
      );
      await load();
    } catch {
      setRevokeMessage("Failed to revoke sessions.");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleSignOutHere = async () => {
    if (signOutEmailSession) await signOutEmailSession();
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="shadow-neo rounded-md border-2 border-black bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-black" />
          <h1 className="text-2xl font-bold text-black">Active sessions</h1>
        </div>

        {emailSession?.email && (
          <p className="mb-4 text-sm text-black">
            Signed in as <strong>{emailSession.email}</strong>.
          </p>
        )}

        {isLoading && <p className="text-black">Loading…</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!isLoading && !error && sessions && sessions.length === 0 && (
          <p className="text-black">No active sessions.</p>
        )}

        {!isLoading && sessions && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`rounded-md border-2 border-black p-3 text-sm text-black ${
                  s.isCurrent ? "bg-green-100" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    Session …{s.id}
                    {s.isCurrent && (
                      <span className="ml-2 text-xs text-green-700">
                        (this device)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-600">
                    {s.scope === "email_session"
                      ? "30-day sign-in"
                      : "15-min subscription"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Created {new Date(s.createdAt).toLocaleString()} · Expires{" "}
                  {new Date(s.expiresAt).toLocaleString()}
                  {s.subscriptionId && (
                    <span> · sub {s.subscriptionId.slice(0, 12)}…</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {revokeMessage && (
          <p className="mt-4 text-sm text-black">{revokeMessage}</p>
        )}

        {sessions && sessions.length > 1 && (
          <Button
            className="mt-4 w-full border-2 border-black bg-red-200 font-bold text-black"
            onClick={handleRevokeOthers}
            isLoading={isRevoking}
          >
            Sign out of every other session
          </Button>
        )}

        <Button
          className="mt-2 w-full border-2 border-black bg-white font-bold text-black"
          onClick={handleSignOutHere}
        >
          Sign out on this device
        </Button>
      </div>
    </div>
  );
}

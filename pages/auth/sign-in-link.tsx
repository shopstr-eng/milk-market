import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button, Input } from "@heroui/react";
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";

type Step = "request" | "sent" | "verifying" | "success" | "error";

export default function SignInLinkPage() {
  const router = useRouter();
  const { token: urlToken } = router.query;
  const { refreshEmailSession } = useContext(SignerContext);

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState("");

  useEffect(() => {
    if (typeof urlToken !== "string" || !urlToken) return;
    let cancelled = false;
    (async () => {
      setStep("verifying");
      try {
        const res = await fetch("/api/auth/verify-email-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: urlToken }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to verify link.");
          setStep("error");
          return;
        }
        setSignedInEmail(data.email || "");
        // Pull the new cookie session into SignerContext immediately so
        // downstream UI (subscription manager, profile pill, etc.) reflects
        // the signed-in state without waiting for a navigation event.
        if (refreshEmailSession) {
          try {
            await refreshEmailSession();
          } catch {
            // best-effort
          }
        }
        setStep("success");
      } catch {
        if (cancelled) return;
        setError("Something went wrong verifying your link.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlToken]);

  const handleRequest = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/request-email-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send sign-in link.");
        return;
      }
      setStep("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="shadow-neo rounded-md border-2 border-black bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <ArrowRightOnRectangleIcon className="h-6 w-6 text-black" />
          <h1 className="text-2xl font-bold text-black">Sign in by email</h1>
        </div>

        {step === "request" && (
          <>
            <p className="mb-4 text-sm text-black">
              Enter your email and we&apos;ll send you a one-time sign-in link.
              The link signs you in for 30 days but cannot sign Nostr events on
              your behalf.
            </p>
            <div className="flex flex-col gap-4">
              <Input
                label="Email Address"
                placeholder="you@example.com"
                variant="bordered"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="text-black"
                startContent={<EnvelopeIcon className="h-5 w-5 text-black" />}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                className="border-2 border-black bg-blue-200 font-bold text-black"
                onClick={handleRequest}
                isLoading={loading}
              >
                Send sign-in link
              </Button>
            </div>
          </>
        )}

        {step === "sent" && (
          <div className="text-center">
            <CheckCircleIcon className="mx-auto mb-3 h-10 w-10 text-green-600" />
            <p className="text-black">
              If an account exists for that email, a sign-in link is on its way.
              Check your inbox.
            </p>
          </div>
        )}

        {step === "verifying" && (
          <p className="text-center text-black">Verifying your link…</p>
        )}

        {step === "success" && (
          <div className="text-center">
            <CheckCircleIcon className="mx-auto mb-3 h-10 w-10 text-green-600" />
            <p className="mb-4 text-black">
              Signed in as <strong>{signedInEmail}</strong>.
            </p>
            <p className="mb-4 text-xs text-gray-600">
              Email-link sign-in lets you manage your subscriptions through this
              device. To sign Nostr events (place orders, send messages, update
              profile), sign in again with your password or nsec.
            </p>
            <Button
              className="border-2 border-black bg-blue-200 font-bold text-black"
              onClick={() => router.push("/messages?tab=subscriptions")}
            >
              Manage my subscriptions
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="text-center">
            <p className="mb-4 text-red-600">{error}</p>
            <Button
              className="border-2 border-black bg-white font-bold text-black"
              onClick={() => {
                setStep("request");
                setError("");
              }}
            >
              Request a new link
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@heroui/react";
import { CheckCircleIcon, KeyIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";

const SubscriptionManagement = dynamic(
  () => import("@/components/messages/subscription-management"),
  { ssr: false }
);

type Step = "verifying" | "ready" | "error";

export default function SubscriptionManagePage() {
  const router = useRouter();
  const { token: urlToken } = router.query;
  const { refreshEmailSession } = useContext(SignerContext);

  const [step, setStep] = useState<Step>("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof urlToken !== "string" || !urlToken) {
      setError(
        "This page requires a valid management link from your email. Please request a new one from the subscription management screen."
      );
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/subscriptions/verify-magic-link", {
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
        // Strip the token from the URL so it can't be re-submitted.
        router.replace("/subscriptions/manage", undefined, { shallow: true });
        if (refreshEmailSession) {
          try {
            await refreshEmailSession();
          } catch {
            // best-effort
          }
        }
        setStep("ready");
      } catch {
        if (cancelled) return;
        setError("Something went wrong verifying your link.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, urlToken]);

  if (step === "verifying") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-black">
        <KeyIcon className="mx-auto mb-3 h-10 w-10" />
        <p>Verifying your management link…</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="shadow-neo rounded-md border-2 border-black bg-white p-6 text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <Button
            className="border-2 border-black bg-blue-200 font-bold text-black"
            onClick={() => router.push("/messages?tab=subscriptions")}
          >
            Back to subscription management
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto mt-4 max-w-3xl px-4">
        <div className="rounded-md border-2 border-black bg-green-100 p-3 text-sm text-black">
          <CheckCircleIcon className="mr-1 inline h-5 w-5 text-green-700" />
          Secure session active for 15 minutes. You can update your address,
          push the next billing date, or cancel below.
        </div>
      </div>
      <SubscriptionManagement />
    </div>
  );
}

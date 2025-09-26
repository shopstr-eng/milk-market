import React from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@nextui-org/react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { BLACKBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";

export default function PrivacyPolicy() {
  const router = useRouter();
  const policyContent = [
    {
      title: "Introduction",
      content:
        "Milk Market is committed to protecting your privacy. As a permissionless marketplace, we minimize data collection and processing to ensure your privacy and security. This policy explains our approach to data handling in the context of a permissionless platform.",
    },
    {
      title: "Information We Don't Collect",
      content:
        "As a fully permissionless platform with no centralized backend, Milk Market does not collect or store: personal identification information, KYC (Know Your Customer) data, financial information, usage tracking data, or user behavior analytics. All data remains under user control through the Nostr protocol and Bitcoin network.",
    },
    {
      title: "Nostr Protocol Data",
      content:
        "Communication and listings through the Nostr protocol are distributed across your selected relays and may include: product listings and metadata, public messages and updates, encrypted direct messages (viewable only by intended recipients), and public keys associated with your Nostr identity. Users select which relays to connect to, determining what content they see and share.",
    },
    {
      title: "Bitcoin & Lightning Network Data",
      content:
        "All transactions occur on the Bitcoin network or Lightning Network and follow their respective privacy models. This may include: transaction amounts, Bitcoin/Lightning addresses or payment requests, and time-stamped records. Cashu ecash transactions provide additional privacy benefits where implemented.",
    },
    {
      title: "Website Usage",
      content:
        "Our website interface is static and does not use cookies or tracking mechanisms. Any data stored is kept locally in your browser and includes: local keys (if using in-browser storage), user preferences, relay selections, and interface settings. Milk Market has no access to this locally stored information.",
    },
    {
      title: "Third-Party Services",
      content:
        "Users may interact with: Bitcoin network and Lightning Network nodes, Nostr relays (which you select), and self-hosted infrastructure. Each third-party service has its own privacy practices. We recommend reviewing the privacy policies of any relays you connect to or payment processors you utilize.",
    },
    {
      title: "Security Measures",
      content:
        "Security is maintained through: open-source code verification (our codebase is publicly available for review), cryptographic protocols for secure communications, Bitcoin network security for transactions, and client-side security measures. Users are responsible for maintaining the security of their private keys and wallets.",
    },
    {
      title: "User Rights and Control",
      content:
        "As a permissionless platform, users maintain full control over their: private keys and funds, product listings, relay selections, communication preferences, and local data storage. You can delete local data at any time through your browser settings. Note that due to the nature of distributed systems, messages and listings published to Nostr relays may persist on those relays according to their individual data retention policies.",
    },
    {
      title: "Changes to Privacy Policy",
      content:
        "Any updates to this privacy policy will be posted on this page. As a permissionless platform, fundamental changes to data handling are unlikely as the platform operates on open protocols with minimal central coordination.",
    },
    {
      title: "Contact Information",
      content:
        "For privacy-related questions, you can reach the Milk Market team through our Nostr channels or GitHub repository.",
    },
  ];

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <title>Privacy Policy - Milk Market | Data Protection & Privacy</title>
        <meta
          name="description"
          content="Learn how Milk Market protects your privacy as a permissionless marketplace. Understand our minimal data collection, Nostr protocol privacy, and user control policies."
        />
        <link rel="canonical" href="https://milk.market/privacy" />
        <link rel="apple-touch-icon" href="/milk-market.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/milk-market.png" />
        <meta property="og:url" content="https://milk.market/privacy" />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="Privacy Policy - Milk Market | Data Protection & Privacy"
        />
        <meta
          property="og:description"
          content="Learn how Milk Market protects your privacy as a permissionless marketplace. Understand our minimal data collection, Nostr protocol privacy, and user control policies."
        />
        <meta property="og:image" content="/milk-market.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="https://milk.market" />
        <meta property="twitter:url" content="https://milk.market/privacy" />
        <meta
          name="twitter:title"
          content="Privacy Policy - Milk Market | Data Protection & Privacy"
        />
        <meta
          name="twitter:description"
          content="Learn how Milk Market protects your privacy as a permissionless marketplace. Understand our minimal data collection, Nostr protocol privacy, and user control policies."
        />
        <meta name="twitter:image" content="/milk-market.png" />
        <meta
          name="keywords"
          content="privacy policy, milk market, data protection, nostr privacy, permissionless platform, decentralized marketplace, user privacy"
        />
      </Head>
      <div className="flex min-h-screen flex-col bg-light-bg py-8 md:pb-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-8">
            <Button
              className={`mb-4 ${BLACKBUTTONCLASSNAMES}`}
              onClick={() => router.back()}
              startContent={<ArrowLeftIcon className="h-4 w-4" />}
            >
              Back
            </Button>
            <h1 className="text-center text-3xl font-bold text-light-text">
              Privacy Policy
            </h1>
          </div>

          <p className="mx-auto mb-10 max-w-3xl text-center text-light-text/80">
            How Milk Market protects your privacy
          </p>

          <div className="mb-4 text-right text-sm text-light-text/70">
            Last updated: 2025-04-25
          </div>

          <div className="space-y-6">
            {policyContent.map((section, sectionIndex) => (
              <div
                key={sectionIndex}
                className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <h3 className="mb-3 text-lg font-semibold text-light-text">
                  {section.title}
                </h3>
                <p className="leading-relaxed text-light-text/90">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

import React from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@nextui-org/react";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  ClipboardDocumentListIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SignalIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { BLACKBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";

export default function Tos() {
  const router = useRouter();
  const tosContent = [
    {
      title: "1. Platform Nature",
      icon: CircleStackIcon,
      content:
        "Milk Market is a permissionless marketplace that operates on Nostr and Bitcoin protocols. We do not hold custody of funds, products, or communications, nor do we act as an intermediary between buyers and sellers. The platform provides an interface for peer-to-peer commerce without central authority.",
    },
    {
      title: "2. Relay Selection",
      icon: SignalIcon,
      content:
        "Users have complete control over which Nostr relays they connect to and consequently which products they see. Milk Market does not control the content available on various relays. Users are responsible for configuring their relay connections according to their preferences and local regulations.",
    },
    {
      title: "3. User Responsibilities",
      icon: ShieldCheckIcon,
      content:
        "Users must maintain the security of their private keys and wallets, understand that transactions are irreversible, verify seller details before purchasing, and comply with local regulations regarding commerce, imports, and taxation. Sellers are responsible for the accuracy of their listings and legal compliance of their products.",
    },
    {
      title: "4. Prohibited Items",
      icon: NoSymbolIcon,
      content:
        "Though Milk Market has no technical ability to prevent listings, users agree not to list or sell illegal goods or services, harmful substances, counterfeit items, stolen property, or any items that violate applicable laws. The community-based nature of Nostr allows users to choose relays that align with their values.",
    },
    {
      title: "5. Transaction Risks",
      icon: ExclamationTriangleIcon,
      content:
        "Users acknowledge that peer-to-peer transactions carry inherent risks including but not limited to: potential for scams, misrepresented items, shipping complications, and payment processing issues. Milk Market cannot intervene in disputes between buyers and sellers.",
    },
    {
      title: "6. Listing Guidelines",
      icon: ClipboardDocumentListIcon,
      content:
        "Listings should contain accurate descriptions, clear images, precise pricing information, and transparent shipping details. Sellers are encouraged to respond promptly to inquiries and maintain professional communication standards.",
    },
    {
      title: "7. Technical Requirements",
      icon: WrenchScrewdriverIcon,
      content:
        "A compatible Bitcoin Lightning wallet and/or Cashu implementation is required for transactions. Nostr key pair needed for authentication and encrypted communication. Users must ensure adequate network fees for transactions and maintain reliable internet connectivity.",
    },
    {
      title: "8. Disclaimers",
      icon: ScaleIcon,
      content:
        "Milk Market is not a custodial service, cannot guarantee product quality or seller reliability, cannot reverse blockchain transactions, and is not responsible for user errors or losses resulting from key mismanagement. Due to the decentralized nature of the platform, Milk Market cannot remove listings from Nostr relays.",
    },
    {
      title: "9. Dispute Resolution",
      icon: ChatBubbleLeftRightIcon,
      content:
        "Any disputes must be resolved directly between buyers and sellers. We encourage users to communicate clearly and honestly. The platform's review system helps create accountability in the marketplace, but Milk Market cannot enforce resolutions or provide refunds.",
    },
    {
      title: "10. Modifications",
      icon: ArrowPathIcon,
      content:
        "These terms may be updated periodically. Users are responsible for reviewing changes. Continued use of Milk Market constitutes acceptance of current terms.",
    },
    {
      title: "Contact",
      icon: EnvelopeIcon,
      content:
        "Questions about these terms can be addressed through our Nostr channels or GitHub repository.",
    },
  ];

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <title>Terms of Service - Milk Market | User Agreement</title>
        <meta
          name="description"
          content="Read Milk Market's Terms of Service. Understand user responsibilities, prohibited items, transaction risks, and platform guidelines for our decentralized marketplace."
        />
        <link rel="canonical" href="https://milk.market/terms" />
        <link rel="apple-touch-icon" href="/milk-market.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/milk-market.png" />
        <meta property="og:url" content="https://milk.market/terms" />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="Terms of Service - Milk Market | User Agreement"
        />
        <meta
          property="og:description"
          content="Read Milk Market's Terms of Service. Understand user responsibilities, prohibited items, transaction risks, and platform guidelines for our decentralized marketplace."
        />
        <meta property="og:image" content="/milk-market.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="https://milk.market" />
        <meta property="twitter:url" content="https://milk.market/terms" />
        <meta
          name="twitter:title"
          content="Terms of Service - Milk Market | User Agreement"
        />
        <meta
          name="twitter:description"
          content="Read Milk Market's Terms of Service. Understand user responsibilities, prohibited items, transaction risks, and platform guidelines for our decentralized marketplace."
        />
        <meta name="twitter:image" content="/milk-market.png" />
        <meta
          name="keywords"
          content="terms of service, milk market, user agreement, nostr marketplace, permissionless platform, bitcoin commerce, decentralized marketplace"
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
              Terms of Service
            </h1>
          </div>

          <p className="mx-auto mb-10 max-w-3xl text-center text-light-text/80">
            User agreement and usage guidelines for Milk Market
          </p>

          <div className="mb-4 text-right text-sm text-light-text/70">
            Last updated: 2025-04-25
          </div>

          <div className="space-y-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-10">
            {tosContent.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <div className="flex items-center">
                  <section.icon className="mr-3 h-6 w-6 shrink-0 text-gray-500" />
                  <h2 className="text-xl font-semibold text-light-text">
                    {section.title}
                  </h2>
                </div>
                <p className="mt-2 pl-9 leading-relaxed text-light-text/80">
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

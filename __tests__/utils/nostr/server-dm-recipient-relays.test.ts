/** @jest-environment node */

// sendServerSideNostrDMToRecipientRelays: the escrow payout notification DM
// must reach the PAYEE's own NIP-65 read relays (∪ defaults ∪ blastr), not
// just the default relay set — the same seller-relay delivery fix as order
// DMs. The plain sendServerSideNostrDM keeps its default-relays-only target.

import {
  sendServerSideNostrDM,
  sendServerSideNostrDMToRecipientRelays,
} from "@/utils/nostr/server-nostr-helpers";
import {
  cacheEvent,
  getDbPool,
  fetchRelayConfigFromDb,
} from "@/utils/db/db-service";

const mockPublish = jest.fn();

jest.mock("@/utils/nostr/contained-relay", () => ({
  publishEventToRelay: (...args: unknown[]) => mockPublish(...args),
}));

jest.mock("@/utils/nostr/nip65-indexer-fetch", () => ({
  fetchKind10002FromIndexers: jest.fn(async () => null),
}));

// DNS safety has dedicated coverage; these routing fixtures use reserved
// .example hostnames and must not depend on a real resolver.
jest.mock("@/utils/url-safety", () => ({
  isSafePublicHostname: jest.fn(async () => true),
}));

jest.mock("nostr-tools", () => ({
  finalizeEvent: jest.fn((event: any) => ({
    ...event,
    id: "wrap-1",
    sig: "s".repeat(128),
  })),
  generateSecretKey: jest.fn(() => new Uint8Array(32).fill(1)),
  getPublicKey: jest.fn(() => "c".repeat(64)),
  getEventHash: jest.fn(() => "rumor-1"),
  nip19: {
    decode: jest.fn(() => ({ type: "nsec", data: new Uint8Array(32) })),
  },
  nip44: {
    getConversationKey: jest.fn(() => new Uint8Array(32)),
    encrypt: jest.fn(() => "ciphertext"),
  },
  verifyEvent: jest.fn(() => true),
}));

jest.mock("@/utils/db/db-service", () => ({
  cacheEvent: jest.fn(),
  getDbPool: jest.fn(),
  fetchRelayConfigFromDb: jest.fn(),
}));

const mocked = {
  cacheEvent: cacheEvent as jest.Mock,
  getDbPool: getDbPool as jest.Mock,
  fetchRelayConfigFromDb: fetchRelayConfigFromDb as jest.Mock,
};

const RECIPIENT = "d".repeat(64);

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://purplepag.es",
  "wss://relay.primal.net",
];
const BLASTR_RELAY = "wss://sendit.nosflare.com";

const queryMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ENCRYPTION_NSEC = "nsec1test";
  mocked.fetchRelayConfigFromDb.mockResolvedValue([
    {
      kind: 10002,
      tags: [
        ["r", "wss://payee.example"], // unmarked = read+write
        ["r", "wss://payee-read.example", "read"],
        ["r", "wss://payee-write.example", "write"],
      ],
    },
  ]);
  mocked.cacheEvent.mockResolvedValue(undefined);
  queryMock.mockResolvedValue({ rows: [] });
  mocked.getDbPool.mockReturnValue({ query: queryMock });
  mockPublish.mockResolvedValue(true);
});

afterEach(() => {
  delete process.env.ENCRYPTION_NSEC;
});

describe("sendServerSideNostrDMToRecipientRelays", () => {
  it("publishes to the recipient's NIP-65 read relays + defaults + blastr", async () => {
    const result = await sendServerSideNostrDMToRecipientRelays(
      RECIPIENT,
      "Your escrow payout arrived.",
      "Escrow payout released"
    );

    expect(result).toBe(true);
    expect(mocked.cacheEvent).toHaveBeenCalledTimes(1);
    const relaysPublishedTo = mockPublish.mock.calls.map(([url]) => url);
    // Read relays: unmarked (read+write) and read-only are both read targets.
    expect(relaysPublishedTo).toContain("wss://payee.example");
    expect(relaysPublishedTo).toContain("wss://payee-read.example");
    // A write-only relay is NOT a read target.
    expect(relaysPublishedTo).not.toContain("wss://payee-write.example");
    for (const def of DEFAULT_RELAYS) {
      expect(relaysPublishedTo).toContain(def);
    }
    expect(relaysPublishedTo).toContain(BLASTR_RELAY);
    expect(new Set(relaysPublishedTo).size).toBe(relaysPublishedTo.length);
  });

  it("still delivers via defaults + blastr when the recipient has no cached relay list", async () => {
    mocked.fetchRelayConfigFromDb.mockRejectedValue(new Error("db down"));

    const result = await sendServerSideNostrDMToRecipientRelays(
      RECIPIENT,
      "msg",
      "subject"
    );

    expect(result).toBe(true);
    const relaysPublishedTo = mockPublish.mock.calls.map(([url]) => url);
    for (const def of DEFAULT_RELAYS) {
      expect(relaysPublishedTo).toContain(def);
    }
    expect(relaysPublishedTo).toContain(BLASTR_RELAY);
  });

  it("returns false without sending when ENCRYPTION_NSEC is not configured", async () => {
    delete process.env.ENCRYPTION_NSEC;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    const result = await sendServerSideNostrDMToRecipientRelays(
      RECIPIENT,
      "msg",
      "subject"
    );

    expect(result).toBe(false);
    expect(mockPublish).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("sendServerSideNostrDM (unchanged default-relay behavior)", () => {
  it("publishes to default relays only — no recipient relay lookup", async () => {
    const result = await sendServerSideNostrDM(RECIPIENT, "msg", "subject");

    expect(result).toBe(true);
    expect(mocked.fetchRelayConfigFromDb).not.toHaveBeenCalled();
    expect(mockPublish.mock.calls.map(([url]) => url)).toEqual(DEFAULT_RELAYS);
  });
});

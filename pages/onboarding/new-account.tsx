import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/router";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  Card,
  CardBody,
  Button,
  Input,
  Image,
  Tooltip,
} from "@nextui-org/react";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { BLUEBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES"; // Changed to BLUE for neo-brutalist theme
import {
  generateKeys,
  setLocalStorageDataOnSignIn,
} from "@/utils/nostr/nostr-helper-functions";
import { RelaysContext } from "../../utils/context/context";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";
import { NostrSigner } from "@/utils/nostr/signers/nostr-signer";
import { NostrNSecSigner } from "@/utils/nostr/signers/nostr-nsec-signer";
import FailureModal from "../../components/utility-components/failure-modal";

const Keys = () => {
  const router = useRouter();

  // Logic from new-account.tsx (no npub, no viewState)
  const [privateKey, setPrivateKey] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [showFailureModal, setShowFailureModal] = useState(false);

  const { newSigner } = useContext(SignerContext);
  const relaysContext = useContext(RelaysContext);

  const saveSigner = (signer: NostrSigner) => {
    if (
      !relaysContext.isLoading &&
      relaysContext.relayList.length >= 0 &&
      relaysContext.readRelayList &&
      relaysContext.writeRelayList
    ) {
      setLocalStorageDataOnSignIn({
        signer,
        relays: relaysContext.relayList,
        readRelays: relaysContext.readRelayList,
        writeRelays: relaysContext.writeRelayList,
      });
    } else {
      setLocalStorageDataOnSignIn({ signer });
    }
  };

  // Logic from new-account.tsx (only generates nsec)
  useEffect(() => {
    const fetchKeys = async () => {
      const { nsec } = await generateKeys();
      setPrivateKey(nsec);
    };

    fetchKeys();
  }, []);

  // Logic from new-account.tsx (no copy handlers)
  const handleNext = async () => {
    if (passphrase === "" || passphrase === null) {
      setShowFailureModal(true);
    } else {
      const { encryptedPrivKey, pubkey } = NostrNSecSigner.getEncryptedNSEC(
        privateKey,
        passphrase
      );
      const signer = newSigner!("nsec", {
        encryptedPrivKey: encryptedPrivKey,
        pubkey,
      });
      await signer.getPubKey();
      saveSigner(signer);
      router.push("/onboarding/user-type");
    }
  };

  return (
    <>
      {/* Styling from keys.tsx (bg-white) */}
      <div className="flex h-[100vh] flex-col bg-white pt-24">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          {/* Styling from keys.tsx (neo-brutalist card) */}
          <Card className="rounded-md border-4 border-black bg-white shadow-neo">
            <CardBody className="p-8">
              {/* Styling from keys.tsx (mb-6, gap-3, text-black) */}
              <div className="mb-6 flex flex-row items-center justify-center gap-3">
                <Image
                  alt="Milk Market logo"
                  height={50}
                  radius="sm"
                  src="/milk-market.png"
                  width={50}
                />
                <h1 className="text-center text-3xl font-bold text-black">
                  Milk Market
                </h1>
              </div>

              {/* Text from new-account.tsx, Styling from keys.tsx */}
              <div className="mb-6 text-center">
                <h2 className="mb-3 text-2xl font-bold text-black">
                  Step 1: Account Creation
                </h2>
                <p className="text-black">
                  Enter a passphrase to make sure your data is secured. You can
                  view your account information under your profile settings.
                </p>
              </div>

              {/* Public and Private key sections from keys.tsx are intentionally removed to match new-account.tsx logic */}

              {/* Passphrase section with styling from keys.tsx */}
              <div className="mb-6 flex flex-col space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xl font-bold text-black">
                    Passphrase:<span className="text-red-500">*</span>
                  </label>
                  <Tooltip
                    // Content from new-account.tsx
                    content="This passphrase acts as a password and is used to keep your account secure. Remember it and keep it safe as it can't be recovered!"
                    placement="right"
                    trigger="focus" // Accessibility from new-account.tsx
                    // Styling from keys.tsx
                    classNames={{
                      content:
                        "bg-black text-white p-3 max-w-xs border-2 border-black",
                    }}
                  >
                    {/* Button wrapper for focus trigger from new-account.tsx */}
                    <button
                      type="button"
                      className="flex items-center justify-center"
                      aria-label="Passphrase information"
                    >
                      {/* Icon styling from keys.tsx */}
                      <InformationCircleIcon className="h-6 w-6 cursor-help text-black" />
                    </button>
                  </Tooltip>
                </div>
                <Input
                  type="password"
                  fullWidth
                  size="lg"
                  value={passphrase}
                  placeholder="Enter a passphrase of your choice..."
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !(passphrase === "" || passphrase === null)
                    )
                      handleNext();
                  }}
                  // Input styling from keys.tsx
                  classNames={{
                    input: "text-black font-medium",
                    inputWrapper:
                      "border-3 border-black rounded-md bg-white shadow-none hover:bg-gray-50 data-[hover=true]:bg-gray-50",
                  }}
                />
              </div>

              {/* Button styling from keys.tsx (mt-4, BLUEBUTTON, ml-1 icon) */}
              <div className="mt-4 flex justify-center">
                <Button className={BLUEBUTTONCLASSNAMES} onClick={handleNext}>
                  Next <ArrowLongRightIcon className="ml-1 h-5 w-5" />
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
      {/* FailureModal from new-account.tsx (SuccessModal is removed) */}
      <FailureModal
        bodyText="No passphrase provided!"
        isOpen={showFailureModal}
        onClose={() => setShowFailureModal(false)}
      />
    </>
  );
};

export default Keys;

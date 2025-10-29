import React, { useContext, useState, useEffect, useMemo } from "react";
import {
  CashuWalletContext,
  ChatsContext,
  ProfileMapContext,
} from "../utils/context/context";
import { useForm } from "react-hook-form";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Image,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Select,
  SelectItem,
  Input,
  Textarea,
} from "@nextui-org/react";
import {
  BanknotesIcon,
  BoltIcon,
  CheckIcon,
  ClipboardIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { fiat } from "@getalby/lightning-tools";
import {
  CashuMint,
  CashuWallet,
  getEncodedToken,
  Proof,
  MintKeyset,
} from "@cashu/cashu-ts";
import {
  constructGiftWrappedEvent,
  constructMessageSeal,
  constructMessageGiftWrap,
  sendGiftWrappedMessageEvent,
  generateKeys,
  getLocalStorageData,
  publishProofEvent,
} from "@/utils/nostr/nostr-helper-functions";
import { addChatMessagesToCache } from "@/utils/nostr/cache-service";
import { LightningAddress } from "@getalby/lightning-tools";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { nip19 } from "nostr-tools";
import { ProductData } from "@/utils/parsers/product-parser-functions";
import { formatWithCommas } from "./utility-components/display-monetary-info";
import { BLUEBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";
import SignInModal from "./sign-in/SignInModal";
import currencySelection from "../public/currencySelection.json";
import FailureModal from "@/components/utility-components/failure-modal";
import CountryDropdown from "./utility-components/dropdowns/country-dropdown";
import {
  NostrContext,
  SignerContext,
} from "@/components/utility-components/nostr-context-provider";
import {
  ShippingFormData,
  ContactFormData,
  CombinedFormData,
} from "@/utils/types/types";
import { Controller } from "react-hook-form";

export default function CartInvoiceCard({
  products,
  quantities,
  shippingTypes,
  totalCostsInSats,
  totalCost,
  onBackToCart,
  setFiatOrderIsPlaced,
  setFiatOrderFailed,
  setInvoiceIsPaid,
  setInvoiceGenerationFailed,
  setCashuPaymentSent,
  setCashuPaymentFailed,
}: {
  products: ProductData[];
  quantities: { [key: string]: number };
  shippingTypes: { [key: string]: string };
  totalCostsInSats: { [key: string]: number };
  totalCost: number;
  onBackToCart?: () => void;
  setFiatOrderIsPlaced?: (fiatOrderIsPlaced: boolean) => void;
  setFiatOrderFailed?: (fiatOrderFailed: boolean) => void;
  setInvoiceIsPaid?: (invoiceIsPaid: boolean) => void;
  setInvoiceGenerationFailed?: (invoiceGenerationFailed: boolean) => void;
  setCashuPaymentSent?: (cashuPaymentSent: boolean) => void;
  setCashuPaymentFailed?: (cashuPaymentFailed: boolean) => void;
}) {
  const { mints, tokens, history } = getLocalStorageData();
  const {
    pubkey: userPubkey,
    npub: userNPub,
    isLoggedIn,
    signer,
  } = useContext(SignerContext);

  // Check if there are tokens available for Cashu payment
  const hasTokensAvailable = tokens && tokens.length > 0;
  const chatsContext = useContext(ChatsContext);
  const profileContext = useContext(ProfileMapContext);

  const { nostr } = useContext(NostrContext);

  const [showInvoiceCard, setShowInvoiceCard] = useState(false);

  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [invoice, setInvoice] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const walletContext = useContext(CashuWalletContext);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [formType, setFormType] = useState<
    "shipping" | "contact" | "combined" | null
  >(null);
  const [showOrderTypeSelection, setShowOrderTypeSelection] = useState(true);

  const [fiatPaymentOptions, setFiatPaymentOptions] = useState<string[]>([]);
  const [showFiatTypeOption, setShowFiatTypeOption] = useState(false);
  const [selectedFiatOption, setSelectedFiatOption] = useState("");
  const [showFiatPaymentInstructions, setShowFiatPaymentInstructions] =
    useState(false);
  const [fiatPaymentConfirmed, setFiatPaymentConfirmed] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);

  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureText, setFailureText] = useState("");

  const [isFormValid, setIsFormValid] = useState(false);
  const [shippingPickupPreference, setShippingPickupPreference] = useState<
    "shipping" | "contact"
  >("shipping");
  const [showFreePickupSelection, setShowFreePickupSelection] = useState(false);
  const [selectedPickupLocations, setSelectedPickupLocations] = useState<{
    [productId: string]: string;
  }>({});

  const {
    handleSubmit: handleFormSubmit,
    control: formControl,
    watch,
  } = useForm();

  // Watch form values to validate completion
  const watchedValues = watch();

  const uniqueShippingTypes = useMemo(() => {
    return Array.from(new Set(Object.values(shippingTypes)));
  }, [shippingTypes]);

  const hasShippingPickupProducts = useMemo(() => {
    return (
      Object.values(shippingTypes).includes("Free/Pickup") ||
      Object.values(shippingTypes).includes("Added Cost/Pickup")
    );
  }, [shippingTypes]);

  const hasMixedShippingWithPickup = useMemo(() => {
    return uniqueShippingTypes.length > 1 && hasShippingPickupProducts;
  }, [uniqueShippingTypes, hasShippingPickupProducts]);

  const [requiredInfo, setRequiredInfo] = useState("");

  useEffect(() => {
    if (products && products.length > 0) {
      const requiredFields = products
        .map((product) => product.required)
        .filter((field) => field)
        .join(", ");
      setRequiredInfo(requiredFields);
    }
  }, [products]);

  // Check if any products have pickup locations
  const productsWithPickupLocations = useMemo(() => {
    return products.filter(
      (product) =>
        (product.shippingType === "Added Cost/Pickup" ||
          product.shippingType === "Free/Pickup" ||
          product.shippingType === "Pickup") &&
        product.pickupLocations &&
        product.pickupLocations.length > 0
    );
  }, [products]);

  useEffect(() => {
    if (!products || products.length === 0) {
      setFiatPaymentOptions([]);
      return;
    } else {
      const firstProduct = products[0]!;
      const firstSellerProfile = profileContext.profileData.get(
        firstProduct.pubkey
      );
      let commonFiatOptions = Object.keys(
        firstSellerProfile?.content?.fiat_options || {}
      );

      for (let i = 1; i < products.length; i++) {
        const productData = products[i]!;
        const sellerProfile = profileContext.profileData.get(
          productData.pubkey
        );
        const currentFiatOptionsKeys = Object.keys(
          sellerProfile?.content?.fiat_options || {}
        );

        commonFiatOptions = commonFiatOptions.filter((option: string) =>
          currentFiatOptionsKeys.includes(option)
        );

        if (commonFiatOptions.length === 0) break;
      }

      setFiatPaymentOptions(commonFiatOptions);
    }
  }, [products, profileContext.profileData]);

  // Validate form completion
  useEffect(() => {
    if (!formType || !watchedValues) {
      setIsFormValid(false);
      return;
    }

    let isValid = false;

    // Check pickup location requirements
    const pickupLocationValid = productsWithPickupLocations.every((product) => {
      const shouldCheckPickup =
        formType === "contact" ||
        (formType === "combined" && shippingPickupPreference === "contact");

      if (shouldCheckPickup) {
        return watchedValues[`pickupLocation_${product.id}`]?.trim();
      }
      return true;
    });

    if (formType === "shipping") {
      isValid = !!(
        watchedValues.Name?.trim() &&
        watchedValues.Address?.trim() &&
        watchedValues.City?.trim() &&
        watchedValues["Postal Code"]?.trim() &&
        watchedValues["State/Province"]?.trim() &&
        watchedValues.Country?.trim() &&
        (!requiredInfo || watchedValues.Required?.trim()) &&
        pickupLocationValid
      );
    } else if (formType === "contact") {
      isValid = !!(
        watchedValues.Contact?.trim() &&
        watchedValues["Contact Type"]?.trim() &&
        watchedValues.Instructions?.trim() &&
        (!requiredInfo || watchedValues.Required?.trim()) &&
        pickupLocationValid
      );
    } else if (formType === "combined") {
      isValid = !!(
        watchedValues.Name?.trim() &&
        watchedValues.Address?.trim() &&
        watchedValues.City?.trim() &&
        watchedValues["Postal Code"]?.trim() &&
        watchedValues["State/Province"]?.trim() &&
        watchedValues.Country?.trim() &&
        watchedValues.Contact?.trim() &&
        watchedValues["Contact Type"]?.trim() &&
        watchedValues.Instructions?.trim() &&
        (!requiredInfo || watchedValues.Required?.trim()) &&
        pickupLocationValid
      );
    }

    setIsFormValid(isValid);
  }, [
    watchedValues,
    formType,
    requiredInfo,
    productsWithPickupLocations,
    shippingPickupPreference,
  ]);

  const generateNewKeys = async () => {
    try {
      const { nsec: nsecForSender, npub: npubForSender } = await generateKeys();
      const { nsec: nsecForReceiver, npub: npubForReceiver } =
        await generateKeys();

      return {
        senderNpub: npubForSender,
        senderNsec: nsecForSender,
        receiverNpub: npubForReceiver,
        receiverNsec: nsecForReceiver,
      };
    } catch (_) {
      return null;
    }
  };

  const sendPaymentAndContactMessage = async (
    pubkeyToReceiveMessage: string,
    message: string,
    product: ProductData,
    isPayment?: boolean,
    isReceipt?: boolean,
    isDonation?: boolean,
    isHerdshare?: boolean,
    orderId?: string,
    paymentType?: string,
    paymentReference?: string,
    paymentProof?: string,
    messageAmount?: number,
    productQuantity?: number,
    retryCount: number = 3
  ) => {
    const newKeys = await generateNewKeys();
    if (!newKeys) {
      setFailureText("Failed to generate new keys for messages!");
      setShowFailureModal(true);
      return;
    }

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        await sendPaymentAndContactMessageWithKeys(
          pubkeyToReceiveMessage,
          message,
          product,
          isPayment,
          isReceipt,
          isDonation,
          orderId,
          paymentType,
          paymentReference,
          paymentProof,
          messageAmount,
          productQuantity,
          newKeys,
          isHerdshare
        );
        // If we get here, the message was sent successfully
        return;
      } catch (error) {
        console.warn(
          `Attempt ${attempt + 1} failed for message sending:`,
          error
        );

        if (attempt === retryCount - 1) {
          // This was the last attempt, log the error but don't throw
          console.error("Failed to send message after all retries:", error);
          return; // Continue with the flow instead of breaking it
        }

        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  };

  const sendPaymentAndContactMessageWithKeys = async (
    pubkeyToReceiveMessage: string,
    message: string,
    product: ProductData,
    isPayment?: boolean,
    isReceipt?: boolean,
    isDonation?: boolean,
    orderId?: string,
    paymentType?: string,
    paymentReference?: string,
    paymentProof?: string,
    messageAmount?: number,
    productQuantity?: number,
    keys?: {
      senderNpub: string;
      senderNsec: string;
      receiverNpub: string;
      receiverNsec: string;
    },
    isHerdshare?: boolean
  ) => {
    if (!keys) {
      setFailureText("Message keys are required!");
      setShowFailureModal(true);
      return;
    }

    if (!isLoggedIn) {
      setFailureText("User is not logged in!");
      setShowFailureModal(true);
      return;
    }

    const decodedRandomPubkeyForSender = nip19.decode(keys.senderNpub);
    const decodedRandomPrivkeyForSender = nip19.decode(keys.senderNsec);
    const decodedRandomPubkeyForReceiver = nip19.decode(keys.receiverNpub);
    const decodedRandomPrivkeyForReceiver = nip19.decode(keys.receiverNsec);

    let messageSubject = "";
    let messageOptions = {};
    if (isPayment) {
      messageSubject = "order-payment";
      messageOptions = {
        isOrder: true,
        type: 3,
        orderAmount: messageAmount ? messageAmount : totalCost,
        orderId,
        productData: product,
        paymentType,
        paymentReference,
        paymentProof,
      };
    } else if (isReceipt) {
      messageSubject = "order-info";
      messageOptions = {
        isOrder: true,
        type: 4,
        orderId,
        productData: product,
        status: "confirmed",
      };
    } else if (isDonation) {
      messageSubject = "donation";
    } else if (isHerdshare) {
      messageSubject = "order-info";
      messageOptions = {
        isOrder: true,
        type: 1,
        orderAmount: messageAmount ? messageAmount : undefined,
        orderId,
        productData: product,
        quantity: productQuantity ? productQuantity : 1,
      };
    } else if (orderId) {
      messageSubject = "order-info";
      messageOptions = {
        isOrder: true,
        type: 1,
        orderAmount: messageAmount ? messageAmount : undefined,
        orderId,
        productData: product,
        quantity: productQuantity ? productQuantity : 1,
      };
    }

    const giftWrappedMessageEvent = await constructGiftWrappedEvent(
      decodedRandomPubkeyForSender.data as string,
      pubkeyToReceiveMessage,
      message,
      messageSubject,
      messageOptions
    );
    const sealedEvent = await constructMessageSeal(
      signer!,
      giftWrappedMessageEvent,
      decodedRandomPubkeyForSender.data as string,
      pubkeyToReceiveMessage,
      decodedRandomPrivkeyForSender.data as Uint8Array
    );
    const giftWrappedEvent = await constructMessageGiftWrap(
      sealedEvent,
      decodedRandomPubkeyForReceiver.data as string,
      decodedRandomPrivkeyForReceiver.data as Uint8Array,
      pubkeyToReceiveMessage
    );
    await sendGiftWrappedMessageEvent(giftWrappedEvent);

    if (isReceipt || isHerdshare) {
      chatsContext.addNewlyCreatedMessageEvent(
        {
          ...giftWrappedMessageEvent,
          sig: "",
          read: false,
        },
        true
      );
      addChatMessagesToCache([
        { ...giftWrappedMessageEvent, sig: "", read: false },
      ]);
    }
  };

  const validatePaymentData = (
    price: number,
    data?: ShippingFormData | ContactFormData | CombinedFormData
  ) => {
    if (price < 1) {
      throw new Error("Payment amount must be greater than 0 sats");
    }

    if (data) {
      if ("Name" in data && "Contact" in data) {
        const combinedData = data as CombinedFormData;
        if (
          !combinedData.Name?.trim() ||
          !combinedData.Address?.trim() ||
          !combinedData.City?.trim() ||
          !combinedData["Postal Code"]?.trim() ||
          !combinedData["State/Province"]?.trim() ||
          !combinedData.Country?.trim() ||
          !combinedData.Contact?.trim() ||
          !combinedData["Contact Type"]?.trim() ||
          !combinedData.Instructions?.trim()
        ) {
          throw new Error("Required fields are missing");
        }
      } else if ("Name" in data) {
        const shippingData = data as ShippingFormData;
        if (
          !shippingData.Name?.trim() ||
          !shippingData.Address?.trim() ||
          !shippingData.City?.trim() ||
          !shippingData["Postal Code"]?.trim() ||
          !shippingData["State/Province"]?.trim() ||
          !shippingData.Country?.trim()
        ) {
          throw new Error("Required shipping fields are missing");
        }
      } else if ("Contact" in data) {
        const contactData = data as ContactFormData;
        if (
          !contactData.Contact?.trim() ||
          !contactData["Contact Type"]?.trim() ||
          !contactData.Instructions?.trim()
        ) {
          throw new Error("Required contact fields are missing");
        }
      }
      if ("Required" in data && data["Required"] !== "") {
        if (!data["Required"]?.trim()) {
          throw new Error("Required fields are missing");
        }
      }
    }
  };

  const onFormSubmit = async (
    data: { [x: string]: string },
    paymentType?: "fiat" | "lightning" | "cashu"
  ) => {
    try {
      let price = totalCost;

      // Convert to sats if needed
      if (products.length > 0) {
        const firstProduct = products[0];
        if (
          !currencySelection.hasOwnProperty(
            firstProduct!.currency.toUpperCase()
          )
        ) {
          throw new Error(
            `${firstProduct!.currency} is not a supported currency.`
          );
        } else if (
          currencySelection.hasOwnProperty(
            firstProduct!.currency.toUpperCase()
          ) &&
          firstProduct!.currency.toLowerCase() !== "sats" &&
          firstProduct!.currency.toLowerCase() !== "sat"
        ) {
          try {
            const currencyData = {
              amount: price,
              currency: firstProduct!.currency,
            };
            const numSats = await fiat.getSatoshiValue(currencyData);
            price = Math.round(numSats);
          } catch (err) {
            console.error("ERROR", err);
          }
        } else if (firstProduct!.currency.toLowerCase() === "btc") {
          price = price * 100000000;
        }
      }

      if (price < 1) {
        throw new Error("Total price is less than 1 sat.");
      }

      const commonData = {
        additionalInfo: data["Required"],
      };

      let paymentData: any = commonData;

      if (formType === "shipping") {
        paymentData = {
          ...paymentData,
          shippingName: data["Name"],
          shippingAddress: data["Address"],
          shippingUnitNo: data["Unit"],
          shippingCity: data["City"],
          shippingPostalCode: data["Postal Code"],
          shippingState: data["State/Province"],
          shippingCountry: data["Country"],
        };
      } else if (formType === "contact") {
        paymentData = {
          ...paymentData,
          contact: data["Contact"],
          contactType: data["Contact Type"],
          contactInstructions: data["Instructions"],
        };
      } else if (formType === "combined") {
        paymentData = {
          ...paymentData,
          shippingName: data["Name"],
          shippingAddress: data["Address"],
          shippingUnitNo: data["Unit"],
          shippingCity: data["City"],
          shippingPostalCode: data["Postal Code"],
          shippingState: data["State/Province"],
          shippingCountry: data["Country"],
          contact: data["Contact"],
          contactType: data["Contact Type"],
          contactInstructions: data["Instructions"],
        };
      }

      if (paymentType === "fiat") {
        setPendingPaymentData(paymentData); // Store the payment data
        if (fiatPaymentOptions.length === 1) {
          setSelectedFiatOption(fiatPaymentOptions[0]!);
          // Show payment instructions
          setShowFiatPaymentInstructions(true);
        } else if (fiatPaymentOptions.length > 1) {
          setShowFiatTypeOption(true);
        }
        return; // Important: exit early for fiat payments
      } else if (paymentType === "cashu") {
        await handleCashuPayment(price, paymentData);
      } else {
        await handleLightningPayment(price, paymentData);
      }
    } catch (error) {
      setFailureText("Payment failed. Please try again.");
      setShowFailureModal(true);
    }
  };

  const handleOrderTypeSelection = (selectedOrderType: string) => {
    setShowOrderTypeSelection(false);

    if (selectedOrderType === "shipping") {
      setFormType("shipping");
    } else if (selectedOrderType === "contact") {
      setFormType("contact");
    } else if (selectedOrderType === "combined") {
      setFormType("combined");
      if (hasMixedShippingWithPickup) {
        setShowFreePickupSelection(true);
      }
    }
  };

  const handleFiatPayment = async (convertedPrice: number, data: any) => {
    try {
      validatePaymentData(convertedPrice, data);
      for (const product of products) {
        const title = product.title;
        const pubkey = product.pubkey;
        const required = product.required;
        const orderId = uuidv4();

        // Generate keys once per order to ensure consistent sender pubkey
        const orderKeys = await generateNewKeys();
        if (!orderKeys) {
          setFailureText("Failed to generate new keys for messages!");
          setShowFailureModal(true);
          return;
        }

        let productDetails = "";
        if (product.selectedSize) {
          productDetails += " in a size " + product.selectedSize;
        }
        if (product.selectedVolume) {
          if (productDetails) {
            productDetails += " and a " + product.selectedVolume;
          } else {
            productDetails += " in a " + product.selectedVolume;
          }
        }
        if (product.selectedWeight) {
          if (productDetails) {
            productDetails += " and weighing " + product.selectedWeight;
          } else {
            productDetails += " weighing " + product.selectedWeight;
          }
        }

        // Add pickup location if available for this specific product
        const pickupLocation =
          selectedPickupLocations[product.id] ||
          data[`pickupLocation_${product.id}`];
        if (pickupLocation) {
          if (productDetails) {
            productDetails += " (pickup at: " + pickupLocation + ")";
          } else {
            productDetails += " (pickup at: " + pickupLocation + ")";
          }
        }

        let paymentMessage = "";
        if (quantities[product.id] && quantities[product.id]! > 1) {
          paymentMessage =
            "You have received an order from " +
            userNPub +
            " for " +
            quantities[product.id] +
            " of your " +
            title +
            " listing" +
            productDetails +
            " on milk.market! Check your " +
            selectedFiatOption +
            " account for the payment.";
        } else {
          paymentMessage =
            "You have received an order from " +
            userNPub +
            " for your " +
            title +
            " listing" +
            productDetails +
            " on milk.market! Check your " +
            selectedFiatOption +
            " account for the payment.";
        }

        await sendPaymentAndContactMessageWithKeys(
          pubkey,
          paymentMessage,
          product,
          true,
          false,
          false,
          orderId,
          "fiat",
          "",
          "",
          undefined,
          quantities[product.id] && quantities[product.id]! > 1
            ? quantities[product.id]
            : 1,
          orderKeys
        );

        if (required && required !== "" && data.additionalInfo) {
          // Add delay before additional info message
          await new Promise((resolve) => setTimeout(resolve, 500));

          const additionalMessage =
            "Additional customer information: " + data.additionalInfo;
          await sendPaymentAndContactMessageWithKeys(
            pubkey,
            additionalMessage,
            product,
            false,
            false,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys
          );
        }

        if (
          !(
            data.shippingName === undefined &&
            data.shippingAddress === undefined &&
            data.shippingUnitNo === undefined &&
            data.shippingCity === undefined &&
            data.shippingPostalCode === undefined &&
            data.shippingState === undefined &&
            data.shippingCountry === undefined &&
            data.contact === undefined &&
            data.contactType === undefined &&
            data.contactInstructions === undefined
          )
        ) {
          const productShippingType = shippingTypes[product.id];

          if (
            productShippingType === "Added Cost" ||
            productShippingType === "Free" ||
            ((productShippingType === "Free/Pickup" ||
              productShippingType === "Added Cost/Pickup") &&
              formType === "shipping")
          ) {
            let contactMessage = "";
            if (!data.shippingUnitNo) {
              contactMessage =
                "Please ship the product" +
                productDetails +
                " to " +
                data.shippingName +
                " at " +
                data.shippingAddress +
                ", " +
                data.shippingCity +
                ", " +
                data.shippingPostalCode +
                ", " +
                data.shippingState +
                ", " +
                data.shippingCountry +
                ".";
            } else {
              contactMessage =
                "Please ship the product" +
                productDetails +
                " to " +
                data.shippingName +
                " at " +
                data.shippingAddress +
                " " +
                data.shippingUnitNo +
                ", " +
                data.shippingCity +
                ", " +
                data.shippingPostalCode +
                ", " +
                data.shippingState +
                ", " +
                data.shippingCountry +
                ".";
            }
            await sendPaymentAndContactMessageWithKeys(
              pubkey,
              contactMessage,
              product,
              false,
              false,
              false,
              orderId,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              orderKeys
            );

            // Add delay between messages
            await new Promise((resolve) => setTimeout(resolve, 500));

            const receiptMessage =
              "Your order for " +
              title +
              productDetails +
              " was processed successfully! If applicable, you should be receiving delivery information from " +
              nip19.npubEncode(product.pubkey) +
              " as soon as they review your order.";
            await sendPaymentAndContactMessageWithKeys(
              userPubkey!,
              receiptMessage,
              product,
              false,
              true,
              false,
              orderId,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              orderKeys
            );
          } else if (
            productShippingType === "N/A" ||
            productShippingType === "Pickup" ||
            ((productShippingType === "Free/Pickup" ||
              productShippingType === "Added Cost/Pickup") &&
              formType === "contact")
          ) {
            let contactMessage;
            let receiptMessage;
            if (productDetails) {
              contactMessage =
                "To finalize the sale of your " +
                title +
                " listing" +
                productDetails +
                " on milk.market, please contact " +
                data.contact +
                " over " +
                data.contactType +
                " using the following instructions: " +
                data.contactInstructions;
              receiptMessage =
                "Your order for " +
                title +
                productDetails +
                " was processed successfully! If applicable, you should be receiving delivery information from " +
                nip19.npubEncode(product.pubkey) +
                " as soon as they review your order.";
            } else {
              contactMessage =
                "To finalize the sale of your " +
                title +
                " listing on milk.market, please contact " +
                data.contact +
                " over " +
                data.contactType +
                " using the following instructions: " +
                data.contactInstructions;
              receiptMessage =
                "Your order for " +
                title +
                " was processed successfully! If applicable, you should be receiving delivery information from " +
                nip19.npubEncode(product.pubkey) +
                " as soon as they review your order.";
            }
            await sendPaymentAndContactMessageWithKeys(
              pubkey,
              contactMessage,
              product,
              false,
              false,
              false,
              orderId,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              orderKeys
            );

            // Add delay between messages
            await new Promise((resolve) => setTimeout(resolve, 500));

            await sendPaymentAndContactMessageWithKeys(
              userPubkey!,
              receiptMessage,
              product,
              false,
              true,
              false,
              orderId,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              orderKeys
            );
          }
        } else {
          let productDetails = "";
          if (product.selectedSize) {
            productDetails += " in size " + product.selectedSize;
          }
          if (product.selectedVolume) {
            if (productDetails) {
              productDetails += " and a " + product.selectedVolume;
            } else {
              productDetails += " in a " + product.selectedVolume;
            }
          }
          if (product.selectedWeight) {
            if (productDetails) {
              productDetails += " and weighing " + product.selectedWeight;
            } else {
              productDetails += " weighing " + product.selectedWeight;
            }
          }

          // Add pickup location if available for this specific product
          const pickupLocation =
            selectedPickupLocations[product.id] ||
            data[`pickupLocation_${product.id}`];
          if (pickupLocation) {
            if (productDetails) {
              productDetails += " (pickup at: " + pickupLocation + ")";
            } else {
              productDetails += " (pickup at: " + pickupLocation + ")";
            }
          }

          const receiptMessage =
            "Thank you for your purchase of " +
            title +
            productDetails +
            " from " +
            nip19.npubEncode(product.pubkey) +
            ".";
          await sendPaymentAndContactMessageWithKeys(
            userPubkey!,
            receiptMessage,
            product,
            false,
            true,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys
          );
        }

        // Send herdshare agreement if product has one
        if (product.herdshareAgreement) {
          // Add delay before herdshare message
          await new Promise((resolve) => setTimeout(resolve, 500));

          const herdshareMessage =
            "To finalize your purchase, sign and send the following herdshare agreement for the dairy: " +
            product.herdshareAgreement;
          await sendPaymentAndContactMessageWithKeys(
            userPubkey!,
            herdshareMessage,
            product,
            false,
            false,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys,
            true
          );
        }
      }
      if (setFiatOrderIsPlaced) {
        setFiatOrderIsPlaced(true);
      }
      setFormType(null);
      setOrderConfirmed(true);
    } catch (error) {
      if (setFiatOrderFailed) {
        setFiatOrderFailed(true);
      } else {
        setFailureText("Fiat payment failed. Please try again.");
        setShowFailureModal(true);
      }
    }
  };

  const handleLightningPayment = async (convertedPrice: number, data: any) => {
    try {
      validatePaymentData(convertedPrice, data);

      setShowInvoiceCard(true);
      const wallet = new CashuWallet(new CashuMint(mints[0]!));

      const { request: pr, quote: hash } =
        await wallet.createMintQuote(convertedPrice);

      setInvoice(pr);

      QRCode.toDataURL(pr)
        .then((url: string) => {
          setQrCodeUrl(url);
        })
        .catch((err: unknown) => {
          console.error("ERROR", err);
        });

      if (typeof window.webln !== "undefined") {
        try {
          await window.webln.enable();
          const isEnabled = await window.webln.isEnabled();
          if (!isEnabled) {
            throw new Error("WebLN is not enabled");
          }
          try {
            const res = await window.webln.sendPayment(pr);
            if (!res) {
              throw new Error("Payment failed");
            }
          } catch (e) {
            console.error(e);
          }
        } catch (e) {
          console.error(e);
        }
      }
      await invoiceHasBeenPaid(wallet, convertedPrice, hash, data);
    } catch (error) {
      if (setInvoiceGenerationFailed) {
        setInvoiceGenerationFailed(true);
      } else {
        setFailureText("Lightning payment failed. Please try again.");
        setShowFailureModal(true);
      }
      setShowInvoiceCard(false);
      setInvoice("");
      setQrCodeUrl(null);
    }
  };

  /** CHECKS WHETHER INVOICE HAS BEEN PAID */
  async function invoiceHasBeenPaid(
    wallet: CashuWallet,
    convertedPrice: number,
    hash: string,
    data: any
  ) {
    let retryCount = 0;
    const maxRetries = 30; // Maximum 30 retries (about 1 minute)

    while (retryCount < maxRetries) {
      try {
        // First check if the quote has been paid
        const quoteState = await wallet.checkMintQuote(hash);

        if (quoteState.state === "PAID") {
          // Quote is paid, try to mint proofs
          try {
            const proofs = await wallet.mintProofs(convertedPrice, hash);
            if (proofs && proofs.length > 0) {
              await sendTokens(wallet, proofs, data);
              localStorage.setItem("cart", JSON.stringify([]));
              setPaymentConfirmed(true);
              if (setInvoiceIsPaid) {
                setInvoiceIsPaid(true);
              }
              setQrCodeUrl(null);
              break;
            }
          } catch (mintError) {
            // If minting fails but quote is paid, it might be already issued
            if (
              mintError instanceof Error &&
              mintError.message.includes("issued")
            ) {
              // Quote was already processed, consider it successful
              localStorage.setItem("cart", JSON.stringify([]));
              setPaymentConfirmed(true);
              setQrCodeUrl(null);
              setFailureText(
                "Payment was received but your connection dropped! Please check your wallet balance."
              );
              setShowFailureModal(true);
              break;
            }
            throw mintError;
          }
        } else if (quoteState.state === "UNPAID") {
          // Quote not paid yet, continue waiting
          retryCount++;
          await new Promise((resolve) => setTimeout(resolve, 2100));
          continue;
        } else if (quoteState.state === "ISSUED") {
          // Quote was already processed successfully
          localStorage.setItem("cart", JSON.stringify([]));
          setPaymentConfirmed(true);
          setQrCodeUrl(null);
          setFailureText(
            "Payment was received but your connection dropped! Please check your wallet balance."
          );
          setShowFailureModal(true);
          break;
        }
      } catch (error) {
        retryCount++;

        if (error instanceof TypeError) {
          setShowInvoiceCard(false);
          setInvoice("");
          setQrCodeUrl(null);
          if (setInvoiceGenerationFailed) {
            setInvoiceGenerationFailed(true);
          } else {
            setFailureText(
              "Failed to validate invoice! Change your mint in settings and/or please try again."
            );
            setShowFailureModal(true);
          }
          break;
        }

        // If we've exceeded max retries, show error
        if (retryCount >= maxRetries) {
          setShowInvoiceCard(false);
          setInvoice("");
          setQrCodeUrl(null);
          if (setInvoiceGenerationFailed) {
            setInvoiceGenerationFailed(true);
          } else {
            setFailureText(
              "Payment timed out! Please check your wallet balance or try again."
            );
            setShowFailureModal(true);
          }
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2100));
      }
    }
  }

  const sendTokens = async (
    wallet: CashuWallet,
    proofs: Proof[],
    data: any
  ) => {
    let remainingProofs = proofs;
    for (const product of products) {
      const title = product.title;
      const pubkey = product.pubkey;
      const required = product.required;
      const tokenAmount = totalCostsInSats[pubkey];
      let sellerToken;
      let donationToken;
      const sellerProfile = profileContext.profileData.get(pubkey);
      const donationPercentage =
        sellerProfile?.content?.shopstr_donation || 2.1;
      const donationAmount = Math.ceil(
        (tokenAmount! * donationPercentage) / 100
      );
      const sellerAmount = tokenAmount! - donationAmount;
      let sellerProofs: Proof[] = [];

      if (sellerAmount > 0) {
        const { keep, send } = await wallet.send(
          sellerAmount,
          remainingProofs,
          {
            includeFees: true,
          }
        );
        sellerProofs = send;
        sellerToken = getEncodedToken({
          mint: mints[0]!,
          proofs: send,
        });
        remainingProofs = keep;
      }

      if (donationAmount > 0) {
        const { keep, send } = await wallet.send(
          donationAmount,
          remainingProofs,
          {
            includeFees: true,
          }
        );
        donationToken = getEncodedToken({
          mint: mints[0]!,
          proofs: send,
        });
        remainingProofs = keep;
      }

      const orderId = uuidv4();

      // Generate keys once per order to ensure consistent sender pubkey
      const orderKeys = await generateNewKeys();
      if (!orderKeys) {
        setFailureText("Failed to generate new keys for messages!");
        setShowFailureModal(true);
        return;
      }
      const paymentPreference =
        sellerProfile?.content?.payment_preference || "ecash";
      const lnurl = sellerProfile?.content?.lud16 || "";

      if (
        paymentPreference === "lightning" &&
        lnurl &&
        lnurl !== "" &&
        !lnurl.includes("@zeuspay.com") &&
        sellerProofs
      ) {
        const newAmount = Math.floor(sellerAmount * 0.98 - 2);
        const ln = new LightningAddress(lnurl);
        await wallet.loadMint();
        await ln.fetch();
        const invoice = await ln.requestInvoice({ satoshi: newAmount });
        const invoicePaymentRequest = invoice.paymentRequest;
        const meltQuote = await wallet.createMeltQuote(invoicePaymentRequest);
        if (meltQuote) {
          const meltQuoteTotal = meltQuote.amount + meltQuote.fee_reserve;
          const { keep, send } = await wallet.send(
            meltQuoteTotal,
            sellerProofs,
            {
              includeFees: true,
            }
          );
          const meltResponse = await wallet.meltProofs(meltQuote, send);
          if (meltResponse.quote) {
            const meltAmount = meltResponse.quote.amount;
            const changeProofs = [...keep, ...meltResponse.change];
            const changeAmount =
              Array.isArray(changeProofs) && changeProofs.length > 0
                ? changeProofs.reduce(
                    (acc, current: Proof) => acc + current.amount,
                    0
                  )
                : 0;
            let productDetails = "";
            if (product.selectedSize) {
              productDetails += " in size " + product.selectedSize;
            }
            if (product.selectedVolume) {
              if (productDetails) {
                productDetails += " and a " + product.selectedVolume;
              } else {
                productDetails += " in a " + product.selectedVolume;
              }
            }
            if (product.selectedWeight) {
              if (productDetails) {
                productDetails += " and weighing " + product.selectedWeight;
              } else {
                productDetails += " weighing " + product.selectedWeight;
              }
            }

            // Add pickup location if available for this specific product
            const pickupLocation =
              selectedPickupLocations[product.id] ||
              data[`pickupLocation_${product.id}`];
            if (pickupLocation) {
              if (productDetails) {
                productDetails += " (pickup at: " + pickupLocation + ")";
              } else {
                productDetails += " (pickup at: " + pickupLocation + ")";
              }
            }

            let paymentMessage = "";
            if (quantities[product.id] && quantities[product.id]! > 1) {
              paymentMessage =
                "You have received a payment from " +
                userNPub +
                " for " +
                quantities[product.id] +
                " of your " +
                title +
                " listing" +
                productDetails +
                " on milk.market! Check your Lightning address (" +
                lnurl +
                ") for your sats.";
            } else {
              paymentMessage =
                "You have received a payment from " +
                userNPub +
                " for your " +
                title +
                " listing" +
                productDetails +
                " on milk.market! Check your Lightning address (" +
                lnurl +
                ") for your sats.";
            }
            await sendPaymentAndContactMessageWithKeys(
              pubkey,
              paymentMessage,
              product,
              true,
              false,
              false,
              orderId,
              "lightning",
              invoicePaymentRequest,
              invoice.preimage ? invoice.preimage : invoice.paymentHash,
              meltAmount,
              quantities[product.id] && quantities[product.id]! > 1
                ? quantities[product.id]
                : 1,
              orderKeys
            );

            if (changeAmount >= 1 && changeProofs && changeProofs.length > 0) {
              // Add delay between messages to prevent browser throttling
              await new Promise((resolve) => setTimeout(resolve, 500));

              const encodedChange = getEncodedToken({
                mint: mints[0]!,
                proofs: changeProofs,
              });
              const changeMessage = "Overpaid fee change: " + encodedChange;
              await sendPaymentAndContactMessageWithKeys(
                pubkey,
                changeMessage,
                product,
                true,
                false,
                false,
                orderId,
                "ecash",
                mints[0],
                JSON.stringify(changeProofs),
                changeAmount,
                undefined,
                orderKeys
              );
            }
          } else {
            const unusedProofs = [...keep, ...send, ...meltResponse.change];
            const unusedAmount =
              Array.isArray(unusedProofs) && unusedProofs.length > 0
                ? unusedProofs.reduce(
                    (acc, current: Proof) => acc + current.amount,
                    0
                  )
                : 0;
            const unusedToken = getEncodedToken({
              mint: mints[0]!,
              proofs: unusedProofs,
            });
            let productDetails = "";
            if (product.selectedSize) {
              productDetails += " in size " + product.selectedSize;
            }
            if (product.selectedVolume) {
              if (productDetails) {
                productDetails += " and a " + product.selectedVolume;
              } else {
                productDetails += " in a " + product.selectedVolume;
              }
            }
            if (product.selectedWeight) {
              if (productDetails) {
                productDetails += " and weighing " + product.selectedWeight;
              } else {
                productDetails += " weighing " + product.selectedWeight;
              }
            }

            // Add pickup location if available for this specific product
            const pickupLocation =
              selectedPickupLocations[product.id] ||
              data[`pickupLocation_${product.id}`];
            if (pickupLocation) {
              if (productDetails) {
                productDetails += " (pickup at: " + pickupLocation + ")";
              } else {
                productDetails += " (pickup at: " + pickupLocation + ")";
              }
            }

            let paymentMessage = "";
            if (unusedToken && unusedProofs) {
              if (quantities[product.id] && quantities[product.id]! > 1) {
                paymentMessage =
                  "This is a Cashu token payment from " +
                  userNPub +
                  " for " +
                  quantities[product.id] +
                  " of your " +
                  title +
                  " listing" +
                  productDetails +
                  " on milk.market: " +
                  unusedToken;
              } else {
                paymentMessage =
                  "This is a Cashu token payment from " +
                  userNPub +
                  " for your " +
                  title +
                  " listing" +
                  productDetails +
                  " on milk.market: " +
                  unusedToken;
              }
              await sendPaymentAndContactMessageWithKeys(
                pubkey,
                paymentMessage,
                product,
                true,
                false,
                false,
                orderId,
                "ecash",
                mints[0],
                JSON.stringify(unusedProofs),
                unusedAmount,
                quantities[product.id] && quantities[product.id]! > 1
                  ? quantities[product.id]
                  : 1,
                orderKeys
              );
            }
          }
        }
      } else {
        let productDetails = "";
        if (product.selectedSize) {
          productDetails += " in size " + product.selectedSize;
        }
        if (product.selectedVolume) {
          if (productDetails) {
            productDetails += " and a " + product.selectedVolume;
          } else {
            productDetails += " in a " + product.selectedVolume;
          }
        }
        if (product.selectedWeight) {
          if (productDetails) {
            productDetails += " and weighing " + product.selectedWeight;
          } else {
            productDetails += " weighing " + product.selectedWeight;
          }
        }

        // Add pickup location if available for this specific product
        const pickupLocation =
          selectedPickupLocations[product.id] ||
          data[`pickupLocation_${product.id}`];
        if (pickupLocation) {
          if (productDetails) {
            productDetails += " (pickup at: " + pickupLocation + ")";
          } else {
            productDetails += " (pickup at: " + pickupLocation + ")";
          }
        }

        let paymentMessage = "";
        if (sellerToken && sellerProofs) {
          if (quantities[product.id] && quantities[product.id]! > 1) {
            paymentMessage =
              "This is a Cashu token payment from " +
              userNPub +
              " for " +
              quantities[product.id] +
              " of your " +
              title +
              " listing" +
              productDetails +
              " on milk.market: " +
              sellerToken;
          } else {
            paymentMessage =
              "This is a Cashu token payment from " +
              userNPub +
              " for your " +
              title +
              " listing" +
              productDetails +
              " on milk.market: " +
              sellerToken;
          }
          await sendPaymentAndContactMessageWithKeys(
            pubkey,
            paymentMessage,
            product,
            true,
            false,
            false,
            orderId,
            "ecash",
            mints[0],
            JSON.stringify(sellerProofs),
            sellerAmount,
            quantities[product.id] && quantities[product.id]! > 1
              ? quantities[product.id]
              : 1,
            orderKeys
          );
        }
      }

      let donationMessage = "";
      if (donationToken) {
        // Add delay before donation message
        await new Promise((resolve) => setTimeout(resolve, 500));

        donationMessage = "Sale donation: " + donationToken;
        await sendPaymentAndContactMessage(
          "a37118a4888e02d28e8767c08caaf73b49abdac391ad7ff18a304891e416dc33",
          donationMessage,
          product,
          false,
          false,
          true
        );
      }

      if (required && required !== "" && data.additionalInfo) {
        // Add delay before additional info message
        await new Promise((resolve) => setTimeout(resolve, 500));

        const additionalMessage =
          "Additional customer information: " + data.additionalInfo;
        await sendPaymentAndContactMessageWithKeys(
          pubkey,
          additionalMessage,
          product,
          false,
          false,
          false,
          orderId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          orderKeys
        );
      }

      // Send herdshare agreement if product has one
      if (product.herdshareAgreement) {
        // Add delay before herdshare message
        await new Promise((resolve) => setTimeout(resolve, 500));

        const herdshareMessage =
          "To finalize your purchase, sign and send the following herdshare agreement for the dairy: " +
          product.herdshareAgreement;
        await sendPaymentAndContactMessageWithKeys(
          userPubkey!,
          herdshareMessage,
          product,
          false,
          false,
          false,
          orderId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          orderKeys,
          true
        );
      }

      // Handle shipping and contact information based on what was provided
      const productShippingType = shippingTypes[product.id];
      const shouldUseShipping =
        formType === "shipping" ||
        (formType === "combined" &&
          (productShippingType !== "Free/Pickup" ||
            ((productShippingType === "Free/Pickup" ||
              productShippingType === "Added Cost/Pickup") &&
              shippingPickupPreference === "shipping")));

      const shouldUseContact =
        formType === "contact" ||
        (formType === "combined" &&
          (productShippingType === "N/A" ||
            productShippingType === "Pickup" ||
            ((productShippingType === "Free/Pickup" ||
              productShippingType === "Added Cost/Pickup") &&
              shippingPickupPreference === "contact")));

      if (
        shouldUseShipping &&
        data.shippingName &&
        data.shippingAddress &&
        data.shippingCity &&
        data.shippingPostalCode &&
        data.shippingState &&
        data.shippingCountry
      ) {
        // Shipping information provided
        if (
          productShippingType === "Added Cost" ||
          productShippingType === "Free" ||
          productShippingType === "Free/Pickup" ||
          productShippingType === "Added Cost/Pickup"
        ) {
          let productDetails = "";
          if (product.selectedSize) {
            productDetails += " in size " + product.selectedSize;
          }
          if (product.selectedVolume) {
            if (productDetails) {
              productDetails += " and a " + product.selectedVolume;
            } else {
              productDetails += " in a " + product.selectedVolume;
            }
          }
          if (product.selectedWeight) {
            if (productDetails) {
              productDetails += " and weighing " + product.selectedWeight;
            } else {
              productDetails += " weighing " + product.selectedWeight;
            }
          }

          // Add pickup location if available for this specific product
          const pickupLocation =
            selectedPickupLocations[product.id] ||
            data[`pickupLocation_${product.id}`];
          if (pickupLocation) {
            if (productDetails) {
              productDetails += " (pickup at: " + pickupLocation + ")";
            } else {
              productDetails += " (pickup at: " + pickupLocation + ")";
            }
          }

          let contactMessage = "";
          if (!data.shippingUnitNo) {
            contactMessage =
              "Please ship the product" +
              productDetails +
              " to " +
              data.shippingName +
              " at " +
              data.shippingAddress +
              ", " +
              data.shippingCity +
              ", " +
              data.shippingPostalCode +
              ", " +
              data.shippingState +
              ", " +
              data.shippingCountry +
              ".";
          } else {
            contactMessage =
              "Please ship the product" +
              productDetails +
              " to " +
              data.shippingName +
              " at " +
              data.shippingAddress +
              " " +
              data.shippingUnitNo +
              ", " +
              data.shippingCity +
              ", " +
              data.shippingPostalCode +
              ", " +
              data.shippingState +
              ", " +
              data.shippingCountry +
              ".";
          }
          await sendPaymentAndContactMessageWithKeys(
            pubkey,
            contactMessage,
            product,
            false,
            false,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys
          );

          // Add delay between messages
          await new Promise((resolve) => setTimeout(resolve, 500));

          const receiptMessage =
            "Your order for " +
            title +
            productDetails +
            " was processed successfully. If applicable, you should be receiving delivery information from " +
            nip19.npubEncode(product.pubkey) +
            " as soon as they review your order.";
          await sendPaymentAndContactMessageWithKeys(
            userPubkey!,
            receiptMessage,
            product,
            false,
            true,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys
          );
        }
      } else if (
        shouldUseContact &&
        data.contact &&
        data.contactType &&
        data.contactInstructions
      ) {
        // Contact information provided
        if (
          productShippingType === "N/A" ||
          productShippingType === "Pickup" ||
          productShippingType === "Free/Pickup" ||
          productShippingType === "Added Cost/Pickup"
        ) {
          let productDetails = "";
          if (product.selectedSize) {
            productDetails += " in size " + product.selectedSize;
          }
          if (product.selectedVolume) {
            if (productDetails) {
              productDetails += " and a " + product.selectedVolume;
            } else {
              productDetails += " in a " + product.selectedVolume;
            }
          }
          if (product.selectedWeight) {
            if (productDetails) {
              productDetails += " and weighing " + product.selectedWeight;
            } else {
              productDetails += " weighing " + product.selectedWeight;
            }
          }

          // Add pickup location if available for this specific product
          const pickupLocation =
            selectedPickupLocations[product.id] ||
            data[`pickupLocation_${product.id}`];
          if (pickupLocation) {
            if (productDetails) {
              productDetails += " (pickup at: " + pickupLocation + ")";
            } else {
              productDetails += " (pickup at: " + pickupLocation + ")";
            }
          }

          let contactMessage;
          let receiptMessage;
          if (productDetails) {
            contactMessage =
              "To finalize the sale of your " +
              title +
              " listing" +
              productDetails +
              " on milk.market, please contact " +
              data.contact +
              " over " +
              data.contactType +
              " using the following instructions: " +
              data.contactInstructions;
            receiptMessage =
              "Your order for " +
              title +
              productDetails +
              " was processed successfully. If applicable, you should be receiving delivery information from " +
              nip19.npubEncode(product.pubkey) +
              " as soon as they review your order.";
          } else {
            contactMessage =
              "To finalize the sale of your " +
              title +
              " listing on milk.market, please contact " +
              data.contact +
              " over " +
              data.contactType +
              " using the following instructions: " +
              data.contactInstructions;
            receiptMessage =
              "Your order for " +
              title +
              " was processed successfully. If applicable, you should be receiving delivery information from " +
              nip19.npubEncode(product.pubkey) +
              " as soon as they review your order.";
          }
          await sendPaymentAndContactMessageWithKeys(
            pubkey,
            contactMessage,
            product,
            false,
            false,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys
          );

          // Add delay between messages
          await new Promise((resolve) => setTimeout(resolve, 500));

          await sendPaymentAndContactMessageWithKeys(
            userPubkey!,
            receiptMessage,
            product,
            false,
            true,
            false,
            orderId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            orderKeys
          );
        }
      } else {
        let productDetails = "";
        if (product.selectedSize) {
          productDetails += " in size " + product.selectedSize;
        }
        if (product.selectedVolume) {
          if (productDetails) {
            productDetails += " and a " + product.selectedVolume;
          } else {
            productDetails += " in a " + product.selectedVolume;
          }
        }
        if (product.selectedWeight) {
          if (productDetails) {
            productDetails += " and weighing " + product.selectedWeight;
          } else {
            productDetails += " weighing " + product.selectedWeight;
          }
        }

        // Add pickup location if available for this specific product
        const pickupLocation =
          selectedPickupLocations[product.id] ||
          data[`pickupLocation_${product.id}`];
        if (pickupLocation) {
          if (productDetails) {
            productDetails += " (pickup at: " + pickupLocation + ")";
          } else {
            productDetails += " (pickup at: " + pickupLocation + ")";
          }
        }

        const receiptMessage =
          "Thank you for your purchase of " +
          title +
          productDetails +
          " from " +
          nip19.npubEncode(product.pubkey) +
          ".";
        await sendPaymentAndContactMessageWithKeys(
          userPubkey!,
          receiptMessage,
          product,
          false,
          true,
          false,
          orderId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          orderKeys
        );
      }
    }
  };

  const handleCopyInvoice = () => {
    navigator.clipboard.writeText(invoice);
    setCopiedToClipboard(true);
    setTimeout(() => {
      setCopiedToClipboard(false);
    }, 2100);
  };

  const formattedTotalCost = formatWithCommas(totalCost, "sats");

  const handleCashuPayment = async (price: number, data: any) => {
    try {
      if (!mints || mints.length === 0) {
        throw new Error("No Cashu mint available");
      }

      if (!walletContext) {
        throw new Error("Wallet context not available");
      }

      validatePaymentData(price, data);

      const mint = new CashuMint(mints[0]!);
      const wallet = new CashuWallet(mint);
      const mintKeySetIds = await wallet.getKeySets();
      const filteredProofs = tokens.filter(
        (p: Proof) =>
          mintKeySetIds?.some((keysetId: MintKeyset) => keysetId.id === p.id)
      );
      const { keep, send } = await wallet.send(price, filteredProofs, {
        includeFees: true,
      });
      const deletedEventIds = [
        ...new Set([
          ...walletContext.proofEvents
            .filter((event) =>
              event.proofs.some((proof: Proof) =>
                filteredProofs.some(
                  (filteredProof) =>
                    JSON.stringify(proof) === JSON.stringify(filteredProof)
                )
              )
            )
            .map((event) => event.id),
          ...walletContext.proofEvents
            .filter((event) =>
              event.proofs.some((proof: Proof) =>
                keep.some(
                  (keepProof) =>
                    JSON.stringify(proof) === JSON.stringify(keepProof)
                )
              )
            )
            .map((event) => event.id),
          ...walletContext.proofEvents
            .filter((event) =>
              event.proofs.some((proof: Proof) =>
                send.some(
                  (sendProof) =>
                    JSON.stringify(proof) === JSON.stringify(sendProof)
                )
              )
            )
            .map((event) => event.id),
        ]),
      ];
      await sendTokens(wallet, send, data);
      const changeProofs = keep;
      const remainingProofs = tokens.filter(
        (p: Proof) =>
          mintKeySetIds?.some((keysetId: MintKeyset) => keysetId.id !== p.id)
      );
      let proofArray;
      if (changeProofs.length >= 1 && changeProofs) {
        proofArray = [...remainingProofs, ...changeProofs];
      } else {
        proofArray = [...remainingProofs];
      }
      localStorage.setItem("tokens", JSON.stringify(proofArray));
      localStorage.setItem(
        "history",
        JSON.stringify([
          { type: 5, amount: price, date: Math.floor(Date.now() / 1000) },
          ...history,
        ])
      );
      await publishProofEvent(
        nostr!,
        signer!,
        mints[0]!,
        changeProofs && changeProofs.length >= 1 ? changeProofs : [],
        "out",
        price.toString(),
        deletedEventIds
      );
      localStorage.setItem("cart", JSON.stringify([]));
      setOrderConfirmed(true);
      if (setCashuPaymentSent) {
        setCashuPaymentSent(true);
      }
    } catch (error) {
      if (setCashuPaymentFailed) {
        setCashuPaymentFailed(true);
      } else {
        setFailureText("Cashu payment failed. Please try again.");
        setShowFailureModal(true);
      }
    }
  };

  const renderContactForm = () => {
    if (!formType) return null;

    return (
      <div className="space-y-4">
        {(formType === "contact" || formType === "combined") && (
          <>
            <Controller
              name="Contact"
              control={formControl}
              rules={{ required: "A contact is required." }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  classNames={{
                    inputWrapper:
                      "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                    input: "!text-black placeholder:text-gray-400",
                    label: "text-gray-600",
                    innerWrapper: "!bg-white",
                  }}
                  fullWidth={true}
                  label={<span>Contact</span>}
                  labelPlacement="inside"
                  placeholder="@milkmarket"
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  onChange={onChange}
                  isRequired={true}
                  onBlur={onBlur}
                  value={value || ""}
                />
              )}
            />

            <Controller
              name="Contact Type"
              control={formControl}
              rules={{ required: "A contact type is required." }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  classNames={{
                    inputWrapper:
                      "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                    input: "!text-black placeholder:text-gray-400",
                    label: "text-gray-600",
                    innerWrapper: "!bg-white",
                  }}
                  fullWidth={true}
                  label={<span>Contact type</span>}
                  labelPlacement="inside"
                  placeholder="Nostr, Signal, Telegram, email, phone, etc."
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  onChange={onChange}
                  isRequired={true}
                  onBlur={onBlur}
                  value={value || ""}
                />
              )}
            />

            <Controller
              name="Instructions"
              control={formControl}
              rules={{ required: "Delivery instructions are required." }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Textarea
                  classNames={{
                    inputWrapper:
                      "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                    input: "!text-black placeholder:text-gray-400",
                    label: "text-gray-600",
                    innerWrapper: "!bg-white",
                  }}
                  fullWidth={true}
                  label={<span>Delivery instructions</span>}
                  labelPlacement="inside"
                  placeholder="Meet me by . . .; Send file to . . ."
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  onChange={onChange}
                  isRequired={true}
                  onBlur={onBlur}
                  value={value || ""}
                />
              )}
            />
          </>
        )}

        {(formType === "shipping" || formType === "combined") && (
          <>
            <Controller
              name="Name"
              control={formControl}
              rules={{
                required: "A name is required.",
                maxLength: {
                  value: 50,
                  message: "This input exceed maxLength of 50.",
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  classNames={{
                    inputWrapper:
                      "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                    input: "!text-black placeholder:text-gray-400",
                    label: "text-gray-600",
                    innerWrapper: "!bg-white",
                  }}
                  fullWidth={true}
                  label={<span>Name</span>}
                  labelPlacement="inside"
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  onChange={onChange}
                  isRequired={true}
                  onBlur={onBlur}
                  value={value || ""}
                />
              )}
            />

            <Controller
              name="Address"
              control={formControl}
              rules={{
                required: "An address is required.",
                maxLength: {
                  value: 50,
                  message: "This input exceed maxLength of 50.",
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  classNames={{
                    inputWrapper:
                      "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                    input: "!text-black placeholder:text-gray-400",
                    label: "text-gray-600",
                    innerWrapper: "!bg-white",
                  }}
                  fullWidth={true}
                  label={<span>Address</span>}
                  labelPlacement="inside"
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  onChange={onChange}
                  isRequired={true}
                  onBlur={onBlur}
                  value={value || ""}
                />
              )}
            />

            <Controller
              name="Unit"
              control={formControl}
              rules={{
                maxLength: {
                  value: 50,
                  message: "This input exceed maxLength of 50.",
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  classNames={{
                    inputWrapper:
                      "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                    input: "!text-black placeholder:text-gray-400",
                    label: "text-gray-600",
                    innerWrapper: "!bg-white",
                  }}
                  fullWidth={true}
                  label="Apt, suite, unit, etc."
                  labelPlacement="inside"
                  isInvalid={!!error}
                  errorMessage={error?.message}
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value || ""}
                />
              )}
            />

            {/* Two-column layout for City and State/Province */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                name="City"
                control={formControl}
                rules={{
                  required: "A city is required.",
                  maxLength: {
                    value: 50,
                    message: "This input exceed maxLength of 50.",
                  },
                }}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <Input
                    classNames={{
                      inputWrapper:
                        "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                      input: "!text-black placeholder:text-gray-400",
                      label: "text-gray-600",
                      innerWrapper: "!bg-white",
                    }}
                    fullWidth={true}
                    label={<span>City</span>}
                    labelPlacement="inside"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    onChange={onChange}
                    isRequired={true}
                    onBlur={onBlur}
                    value={value || ""}
                  />
                )}
              />

              <Controller
                name="State/Province"
                control={formControl}
                rules={{ required: "A state/province is required." }}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <Input
                    classNames={{
                      inputWrapper:
                        "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                      input: "!text-black placeholder:text-gray-400",
                      label: "text-gray-600",
                      innerWrapper: "!bg-white",
                    }}
                    fullWidth={true}
                    label={<span>State/Province</span>}
                    labelPlacement="inside"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    onChange={onChange}
                    isRequired={true}
                    onBlur={onBlur}
                    value={value || ""}
                  />
                )}
              />
            </div>

            {/* Two-column layout for Postal Code and Country */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                name="Postal Code"
                control={formControl}
                rules={{
                  required: "A postal code is required.",
                  maxLength: {
                    value: 50,
                    message: "This input exceed maxLength of 50.",
                  },
                }}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <Input
                    classNames={{
                      inputWrapper:
                        "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                      input: "!text-black placeholder:text-gray-400",
                      label: "text-gray-600",
                      innerWrapper: "!bg-white",
                    }}
                    fullWidth={true}
                    label={<span>Postal code</span>}
                    labelPlacement="inside"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    onChange={onChange}
                    isRequired={true}
                    onBlur={onBlur}
                    value={value || ""}
                  />
                )}
              />

              <Controller
                name="Country"
                control={formControl}
                rules={{ required: "A country is required." }}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <CountryDropdown
                    classNames={{
                      trigger:
                        "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white data-[hover=true]:!bg-white data-[focus=true]:!bg-white",
                      value: "!text-black",
                      label: "text-gray-600 font-normal",
                      innerWrapper: "!bg-white",
                    }}
                    aria-label="Select Country"
                    label={<span>Country</span>}
                    labelPlacement="inside"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    onChange={onChange}
                    isRequired={true}
                    onBlur={onBlur}
                    value={value || ""}
                  />
                )}
              />
            </div>
          </>
        )}

        {/* Pickup location selectors for products with pickup locations */}
        {productsWithPickupLocations.length > 0 &&
          (formType === "contact" ||
            (formType === "combined" &&
              shippingPickupPreference === "contact")) && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">
                Select Pickup Locations
              </h4>
              {productsWithPickupLocations.map((product) => (
                <Controller
                  key={product.id}
                  name={`pickupLocation_${product.id}`}
                  control={formControl}
                  rules={{ required: "A pickup location is required." }}
                  render={({
                    field: { onChange, onBlur, value },
                    fieldState: { error },
                  }) => (
                    <Select
                      className="rounded-md border-2 border-black bg-white shadow-neo"
                      label={<span>{product.title} - Pickup Location</span>}
                      placeholder="Select pickup location"
                      isInvalid={!!error}
                      errorMessage={error?.message}
                      onChange={(e) => {
                        onChange(e);
                        setSelectedPickupLocations((prev) => ({
                          ...prev,
                          [product.id]: e.target.value,
                        }));
                      }}
                      isRequired={true}
                      onBlur={onBlur}
                      value={value || ""}
                    >
                      {(product.pickupLocations || []).map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                />
              ))}
            </div>
          )}

        {requiredInfo && requiredInfo !== "" && (
          <Controller
            name="Required"
            control={formControl}
            rules={{ required: "Additional information is required." }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { error },
            }) => (
              <Input
                classNames={{
                  inputWrapper:
                    "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white focus-within:!bg-white data-[hover=true]:!bg-white group-data-[focus=true]:!bg-white",
                  input: "!text-black placeholder:text-gray-400",
                  label: "text-gray-600",
                  innerWrapper: "!bg-white",
                }}
                fullWidth={true}
                label={<span>Enter {requiredInfo}</span>}
                labelPlacement="inside"
                isInvalid={!!error}
                errorMessage={error?.message}
                onChange={onChange}
                isRequired={true}
                onBlur={onBlur}
                value={value || ""}
              />
            )}
          />
        )}
      </div>
    );
  };

  if (showInvoiceCard) {
    return (
      <div className="flex min-h-screen w-full bg-white text-black">
        <div className="mx-auto flex w-full flex-col lg:flex-row">
          {/* Order Summary - Full width on mobile, half on desktop */}
          <div className="w-full bg-white p-6 lg:w-1/2">
            <div className="sticky top-6">
              <h2 className="mb-6 text-2xl font-bold">Order Summary</h2>

              <div className="mb-6 space-y-4">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center space-x-4">
                    <Image
                      src={product.images[0]}
                      alt={product.title}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{product.title}</h3>
                      {product.selectedSize && (
                        <p className="text-sm text-gray-600">
                          Size: {product.selectedSize}
                        </p>
                      )}
                      {product.selectedVolume && (
                        <p className="text-sm text-gray-600">
                          Volume: {product.selectedVolume}
                        </p>
                      )}
                      {product.selectedWeight && (
                        <p className="text-sm text-gray-600">
                          Weight: {product.selectedWeight}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        Quantity: {quantities[product.id] || 1}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">
                    Cost Breakdown
                  </h4>
                  <div className="space-y-3">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="space-y-2 border-l-2 border-gray-200 pl-3"
                      >
                        <div className="text-sm font-medium">
                          {product.title}{" "}
                          {quantities[product.id] &&
                            quantities[product.id]! > 1 &&
                            `(x${quantities[product.id]})`}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="ml-2">Product cost:</span>
                          <span>
                            {formatWithCommas(
                              (product.weightPrice !== undefined
                                ? product.weightPrice
                                : product.volumePrice !== undefined
                                  ? product.volumePrice
                                  : product.price) *
                                (quantities[product.id] || 1),
                              "sats"
                            )}
                          </span>
                        </div>
                        {product.shippingCost! > 0 &&
                          ((formType === "combined" &&
                            shippingPickupPreference === "shipping") ||
                            formType === "shipping") && (
                            <div className="flex justify-between text-sm">
                              <span className="ml-2">Shipping cost:</span>
                              <span>
                                {formatWithCommas(
                                  product.shippingCost!,
                                  "sats"
                                )}
                              </span>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total:</span>
                    <span>{formatWithCommas(totalCost, "sats")}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onBackToCart?.()}
                className="mt-4 text-black underline hover:text-gray-700"
              >
                ← Back to cart
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-300 lg:h-full lg:w-px"></div>

          {/* Right Side - Lightning Invoice - maintain consistent width */}
          <div className="w-full p-6 lg:w-1/2">
            <Card className="w-full">
              <CardHeader className="flex justify-center gap-3">
                <span className="text-xl font-bold">Lightning Invoice</span>
              </CardHeader>
              <Divider />
              <CardBody className="flex flex-col items-center">
                {!paymentConfirmed ? (
                  <div className="flex flex-col items-center justify-center">
                    {qrCodeUrl ? (
                      <>
                        <h3 className="text-dark-text mt-3 text-center text-lg font-medium leading-6">
                          Don&apos;t refresh or close the page until the payment
                          has been confirmed!
                        </h3>
                        <Image
                          alt="Lightning invoice"
                          className="object-cover"
                          src={qrCodeUrl}
                        />
                        <div className="flex items-center justify-center">
                          <p className="text-center">
                            {invoice.length > 30
                              ? `${invoice.substring(
                                  0,
                                  10
                                )}...${invoice.substring(
                                  invoice.length - 10,
                                  invoice.length
                                )}`
                              : invoice}
                          </p>
                          <ClipboardIcon
                            onClick={handleCopyInvoice}
                            className={`text-dark-text ml-2 h-4 w-4 cursor-pointer ${
                              copiedToClipboard ? "hidden" : ""
                            }`}
                          />
                          <CheckIcon
                            className={`text-dark-text ml-2 h-4 w-4 cursor-pointer ${
                              copiedToClipboard ? "" : "hidden"
                            }`}
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <p>Waiting for lightning invoice...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <h3 className="text-dark-text mt-3 text-center text-lg font-medium leading-6">
                      Payment confirmed!
                    </h3>
                    <Image
                      alt="Payment Confirmed"
                      className="object-cover"
                      src="../payment-confirmed.gif"
                      width={350}
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-white text-black">
      <div className="mx-auto flex w-full flex-col lg:flex-row">
        {/* Order Summary - Full width on mobile, half on desktop */}
        <div className="w-full bg-white p-6 lg:w-1/2">
          <div className="sticky top-6">
            <h2 className="mb-6 text-2xl font-bold">Order Summary</h2>

            <div className="mb-6 space-y-4">
              {products.map((product) => (
                <div key={product.id} className="flex items-center space-x-4">
                  <Image
                    src={product.images[0]}
                    alt={product.title}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{product.title}</h3>
                    {product.selectedSize && (
                      <p className="text-sm text-gray-600">
                        Size: {product.selectedSize}
                      </p>
                    )}
                    {product.selectedVolume && (
                      <p className="text-sm text-gray-600">
                        Volume: {product.selectedVolume}
                      </p>
                    )}
                    {product.selectedWeight && (
                      <p className="text-sm text-gray-600">
                        Weight: {product.selectedWeight}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      Quantity: {quantities[product.id] || 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">Cost Breakdown</h4>
                <div className="space-y-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="space-y-2 border-l-2 border-gray-200 pl-3"
                    >
                      <div className="text-sm font-medium">
                        {product.title}{" "}
                        {quantities[product.id] &&
                          quantities[product.id]! > 1 &&
                          `(x${quantities[product.id]})`}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="ml-2">Product cost:</span>
                        <span>
                          {formatWithCommas(
                            (product.weightPrice !== undefined
                              ? product.weightPrice
                              : product.volumePrice !== undefined
                                ? product.volumePrice
                                : product.price) *
                              (quantities[product.id] || 1),
                            "sats"
                          )}
                        </span>
                      </div>
                      {product.shippingCost! > 0 &&
                        ((formType === "combined" &&
                          shippingPickupPreference === "shipping") ||
                          formType === "shipping") && (
                          <div className="flex justify-between text-sm">
                            <span className="ml-2">Shipping cost:</span>
                            <span>
                              {formatWithCommas(product.shippingCost!, "sats")}
                            </span>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total:</span>
                  <span>{formatWithCommas(totalCost, "sats")}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onBackToCart?.()}
              className="mt-4 text-black underline hover:text-gray-700"
            >
              ← Back to cart
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gray-300 lg:h-full lg:w-px"></div>

        {/* Right Side - Order Type Selection, Forms, and Payment */}
        <div className="w-full p-6 lg:w-1/2">
          {/* Order Type Selection */}
          {showOrderTypeSelection && (
            <>
              <h2 className="mb-6 text-2xl font-bold">Select Order Type</h2>
              <div className="space-y-4">
                {/* Check if we have mixed shipping types or all products are Free/Pickup */}
                {uniqueShippingTypes.length > 1 ? (
                  <>
                    {/* Mixed shipping types - only show combined */}
                    <button
                      onClick={() => handleOrderTypeSelection("combined")}
                      className="w-full transform rounded-md border-2 border-black bg-white p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                    >
                      <div className="font-medium">Mixed delivery</div>
                      <div className="text-sm text-gray-500">
                        {hasShippingPickupProducts
                          ? "Products require different delivery methods (includes flexible shipping/pickup options)"
                          : "Products require different delivery methods"}
                      </div>
                    </button>
                  </>
                ) : uniqueShippingTypes.length === 1 &&
                  (uniqueShippingTypes[0] === "Free/Pickup" ||
                    uniqueShippingTypes[0] === "Added Cost/Pickup") ? (
                  <>
                    {/* All products have Free/Pickup - show shipping and contact options */}
                    <button
                      onClick={() => handleOrderTypeSelection("shipping")}
                      className="w-full transform rounded-md border-2 border-black bg-white p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                    >
                      <div className="font-medium">Free or added shipping</div>
                      <div className="text-sm text-gray-500">
                        Get products shipped to your address
                      </div>
                    </button>
                    <button
                      onClick={() => handleOrderTypeSelection("contact")}
                      className="w-full transform rounded-md border-2 border-black bg-white p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                    >
                      <div className="font-medium">Pickup</div>
                      <div className="text-sm text-gray-500">
                        Arrange pickup with seller
                      </div>
                    </button>
                  </>
                ) : uniqueShippingTypes.includes("Free") ||
                  uniqueShippingTypes.includes("Added Cost") ? (
                  <button
                    onClick={() => handleOrderTypeSelection("shipping")}
                    className="w-full transform rounded-md border-2 border-black bg-white p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                  >
                    <div className="font-medium">
                      Online order with shipping
                    </div>
                    <div className="text-sm text-gray-500">
                      Get products shipped to your address
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOrderTypeSelection("contact")}
                    className="w-full transform rounded-md border-2 border-black bg-white p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                  >
                    <div className="font-medium">Online order</div>
                    <div className="text-sm text-gray-500">
                      Digital or pickup delivery
                    </div>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Free/Pickup Preference Selection */}
          {showFreePickupSelection && (
            <>
              <h2 className="mb-6 text-2xl font-bold">
                Shipping/Pickup Products Preference
              </h2>
              <p className="mb-4 text-gray-600">
                Some products offer both shipping and pickup options. How would
                you like to handle these products?
              </p>
              <div className="mb-6 space-y-4">
                <button
                  onClick={() => {
                    setShippingPickupPreference("shipping");
                    setShowFreePickupSelection(false);
                  }}
                  className={`w-full transform rounded-md border-2 border-black p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5 ${
                    shippingPickupPreference === "shipping"
                      ? "bg-primary-yellow"
                      : "bg-white"
                  }`}
                >
                  <div className="font-medium">Free or added shipping</div>
                  <div className="text-sm text-gray-500">
                    Arrange shipping for products that offer it
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShippingPickupPreference("contact");
                    setShowFreePickupSelection(false);
                  }}
                  className={`w-full transform rounded-md border-2 border-black p-4 text-left shadow-neo transition-transform hover:-translate-y-0.5 active:translate-y-0.5 ${
                    shippingPickupPreference === "contact"
                      ? "bg-primary-yellow"
                      : "bg-white"
                  }`}
                >
                  <div className="font-medium">Pickup</div>
                  <div className="text-sm text-gray-500">
                    Arrange pickup for products that offer it
                  </div>
                </button>
              </div>

              {/* Show pickup location selection for products with pickup locations */}
              {productsWithPickupLocations.length > 0 &&
                shippingPickupPreference === "contact" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">
                      Select Pickup Locations
                    </h3>
                    {productsWithPickupLocations.map((product) => (
                      <div key={product.id} className="space-y-2">
                        <h4 className="font-medium">{product.title}</h4>
                        <Select
                          classNames={{
                            trigger:
                              "border-2 border-black rounded-md shadow-neo !bg-white hover:!bg-white data-[hover=true]:!bg-white data-[focus=true]:!bg-white",
                            value: "!text-black",
                            label: "text-gray-600",
                          }}
                          label="Select pickup location"
                          placeholder="Choose a pickup location"
                          value={selectedPickupLocations[product.id] || ""}
                          onChange={(e) => {
                            setSelectedPickupLocations((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }));
                          }}
                        >
                          {(product.pickupLocations || []).map((location) => (
                            <SelectItem key={location} value={location}>
                              {location}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}

          {/* Contact/Shipping Form */}
          {formType && !showFreePickupSelection && (
            <>
              <h2 className="mb-6 text-2xl font-bold">
                {formType === "shipping" && "Shipping Information"}
                {formType === "contact" && "Contact Information"}
                {formType === "combined" && "Delivery Information"}
              </h2>

              <form
                onSubmit={handleFormSubmit((data) => onFormSubmit(data))}
                className="space-y-6"
              >
                {renderContactForm()}

                <div className="space-y-4 border-t pt-6">
                  <h3 className="mb-4 text-lg font-semibold">Payment Method</h3>

                  {fiatPaymentOptions.length > 0 && (
                    <Button
                      className={`${BLUEBUTTONCLASSNAMES} w-full ${
                        !isFormValid ? "cursor-not-allowed opacity-50" : ""
                      }`}
                      disabled={!isFormValid}
                      onClick={() => {
                        if (!isLoggedIn) {
                          onOpen();
                          return;
                        }
                        handleFormSubmit((data) =>
                          onFormSubmit(data, "fiat")
                        )();
                      }}
                      startContent={<CurrencyDollarIcon className="h-6 w-6" />}
                    >
                      Pay with Fiat
                    </Button>
                  )}

                  <Button
                    className={`${BLUEBUTTONCLASSNAMES} w-full ${
                      !isFormValid ? "cursor-not-allowed opacity-50" : ""
                    }`}
                    disabled={!isFormValid}
                    onClick={() => {
                      if (!isLoggedIn) {
                        onOpen();
                        return;
                      }
                      handleFormSubmit((data) =>
                        onFormSubmit(data, "lightning")
                      )();
                    }}
                    startContent={<BoltIcon className="h-6 w-6" />}
                  >
                    Pay with Lightning: {formattedTotalCost}
                  </Button>

                  {hasTokensAvailable && (
                    <Button
                      className={`${BLUEBUTTONCLASSNAMES} w-full ${
                        !isFormValid ? "cursor-not-allowed opacity-50" : ""
                      }`}
                      disabled={!isFormValid}
                      onClick={() => {
                        if (!isLoggedIn) {
                          onOpen();
                          return;
                        }
                        handleFormSubmit((data) =>
                          onFormSubmit(data, "cashu")
                        )();
                      }}
                      startContent={<BanknotesIcon className="h-6 w-6" />}
                    >
                      Pay with Cashu: {formattedTotalCost}
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
          {orderConfirmed && (
            <div className="flex flex-col items-center justify-center">
              <h3 className="mt-3 text-center text-lg font-medium leading-6 text-gray-900">
                Order confirmed!
              </h3>
              <Image
                alt="Payment Confirmed"
                className="object-cover"
                src="../payment-confirmed.gif"
                width={350}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        backdrop="blur"
        isOpen={showFiatTypeOption}
        onClose={() => setShowFiatTypeOption(false)}
        classNames={{
          body: "py-6 bg-dark-fg",
          backdrop: "bg-[#292f46]/50 backdrop-opacity-60",
          header: "border-b-[1px] border-[#292f46] bg-dark-fg rounded-t-lg",
          footer: "border-t-[1px] border-[#292f46] bg-dark-fg rounded-b-lg",
          closeButton: "hover:bg-black/5 active:bg-white/10",
        }}
        isDismissable={true}
        scrollBehavior={"normal"}
        placement={"center"}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader className="text-dark-text flex items-center justify-center">
            Select your fiat payment preference:
          </ModalHeader>
          <ModalBody className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-center">
              <Select
                label="Fiat Payment Options"
                className="max-w-xs"
                onChange={(e) => {
                  setSelectedFiatOption(e.target.value);
                  setShowFiatTypeOption(false);
                  // Show payment instructions
                  setShowFiatPaymentInstructions(true);
                }}
              >
                {fiatPaymentOptions &&
                  fiatPaymentOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className="text-dark-text"
                    >
                      {option}
                    </SelectItem>
                  ))}
              </Select>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Fiat Payment Instructions */}
      {showFiatPaymentInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-w-md rounded-lg bg-white p-8 text-center">
            {selectedFiatOption === "cash" ? (
              <>
                <h3 className="mb-4 text-2xl font-bold text-gray-900">
                  Cash Payment
                </h3>
                <p className="mb-6 text-gray-600">
                  You will need {formatWithCommas(totalCost, "sats")} in cash
                  for this order.
                </p>
                <div className="mb-6 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="paymentConfirmed"
                    checked={fiatPaymentConfirmed}
                    onChange={(e) => setFiatPaymentConfirmed(e.target.checked)}
                    className="text-light-text focus:ring-accent-light-text h-4 w-4 rounded border-gray-300"
                  />
                  <label
                    htmlFor="paymentConfirmed"
                    className="text-left text-gray-700"
                  >
                    I will have the sufficient cash to complete the order upon
                    pickup or delivery
                  </label>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-4 text-2xl font-bold text-gray-900">
                  Send Payment
                </h3>
                <p className="mb-4 text-gray-600">
                  Please send {formatWithCommas(totalCost, "sats")} to:
                </p>
                <div className="mb-6 rounded-lg bg-gray-100 p-4">
                  <p className="font-semibold text-gray-900">
                    {selectedFiatOption}:{" "}
                    {(products.length > 0 &&
                      profileContext.profileData.get(products[0]!.pubkey)
                        ?.content?.fiat_options?.[selectedFiatOption]) ||
                      "N/A"}
                  </p>
                </div>
                <div className="mb-6 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="paymentConfirmed"
                    checked={fiatPaymentConfirmed}
                    onChange={(e) => setFiatPaymentConfirmed(e.target.checked)}
                    className="text-light-text focus:ring-accent-light-text h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="paymentConfirmed" className="text-gray-300">
                    I have sent the payment
                  </label>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Button
                onClick={async () => {
                  if (fiatPaymentConfirmed) {
                    setShowFiatPaymentInstructions(false);
                    await handleFiatPayment(
                      totalCost,
                      pendingPaymentData || {}
                    );
                    setPendingPaymentData(null); // Clear stored data
                  }
                }}
                disabled={!fiatPaymentConfirmed}
                className={`${BLUEBUTTONCLASSNAMES} w-full ${
                  !fiatPaymentConfirmed ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                {selectedFiatOption === "cash"
                  ? "Confirm Order"
                  : "Confirm Payment Sent"}
              </Button>
              <Button
                onClick={() => {
                  setShowFiatPaymentInstructions(false);
                  setFiatPaymentConfirmed(false);
                  setSelectedFiatOption("");
                  setPendingPaymentData(null); // Clear stored data
                }}
                variant="bordered"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <SignInModal isOpen={isOpen} onClose={onClose} />

      <FailureModal
        bodyText={failureText}
        isOpen={showFailureModal}
        onClose={() => {
          setShowFailureModal(false);
          setFailureText("");
        }}
      />
    </div>
  );
}

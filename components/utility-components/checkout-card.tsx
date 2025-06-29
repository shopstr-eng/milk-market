/* eslint-disable @next/next/no-img-element */

import React, { useContext, useEffect, useRef, useState } from "react";
import { nip19 } from "nostr-tools";
import { ProductData } from "@/utils/parsers/product-parser-functions";
import { ProfileWithDropdown } from "./profile/profile-dropdown";
import {
  DisplayCostBreakdown,
  DisplayCheckoutCost,
} from "./display-monetary-info";
import ProductInvoiceCard from "../product-invoice-card";
import { useRouter } from "next/router";
import { BLACKBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";
import { Button, Chip, useDisclosure } from "@nextui-org/react";
import { locationAvatar } from "./dropdowns/location-dropdown";
import {
  FaceFrownIcon,
  FaceSmileIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { ReviewsContext } from "@/utils/context/context";
import FailureModal from "../utility-components/failure-modal";
import SuccessModal from "../utility-components/success-modal";
import SignInModal from "../sign-in/SignInModal";
import currencySelection from "../../public/currencySelection.json";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";

const SUMMARY_CHARACTER_LIMIT = 100;

export default function CheckoutCard({
  productData,
  setFiatOrderIsPlaced,
  setInvoiceIsPaid,
  setInvoiceGenerationFailed,
  setCashuPaymentSent,
  setCashuPaymentFailed,
  uniqueKey,
}: {
  productData: ProductData;
  setFiatOrderIsPlaced?: (fiatOrderIsPlaced: boolean) => void;
  setInvoiceIsPaid?: (invoiceIsPaid: boolean) => void;
  setInvoiceGenerationFailed?: (invoiceGenerationFailed: boolean) => void;
  setCashuPaymentSent?: (cashuPaymentSent: boolean) => void;
  setCashuPaymentFailed?: (cashuPaymentFailed: boolean) => void;
  uniqueKey?: string;
}) {
  const { pubkey: userPubkey, isLoggedIn } = useContext(SignerContext);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isBeingPaid, setIsBeingPaid] = useState(false);
  const [visibleImages, setVisibleImages] = useState<string[]>([]);
  const [showAllImages, setShowAllImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState(productData.images[0]);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    undefined
  );
  const [hasSizes, setHasSizes] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const [merchantReview, setMerchantReview] = useState(0);
  const [productReviews, setProductReviews] =
    useState<Map<string, string[][]>>();
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);

  const [merchantQuality, setMerchantQuality] = useState("");

  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureText, setFailureText] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [cart, setCart] = useState<ProductData[]>([]);

  const reviewsContext = useContext(ReviewsContext);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const renderSummary = () => {
    if (productData.summary.length <= SUMMARY_CHARACTER_LIMIT || isExpanded) {
      return productData.summary;
    }
    return `${productData.summary.slice(0, SUMMARY_CHARACTER_LIMIT)}...`;
  };

  const calculateVisibleImages = (containerHeight: number) => {
    const imageHeight = containerHeight / 3;
    const visibleCount = Math.floor(containerHeight / imageHeight);
    setVisibleImages(productData.images.slice(0, visibleCount));
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cartList = localStorage.getItem("cart")
        ? JSON.parse(localStorage.getItem("cart") as string)
        : [];
      if (cartList && cartList.length > 0) {
        setCart(cartList);
      }
    }
  }, []);

  useEffect(() => {
    const productExists = cart.some(
      (item: ProductData) => item.id === productData.id
    );
    if (productExists) {
      setIsAdded(true);
    }
  }, [cart, productData.id]);

  useEffect(() => {
    setIsFetchingReviews(true);
    if (
      productData.pubkey &&
      reviewsContext.merchantReviewsData.has(productData.pubkey) &&
      typeof reviewsContext.merchantReviewsData.get(productData.pubkey) !=
        "undefined" &&
      reviewsContext.productReviewsData.has(productData.pubkey) &&
      typeof reviewsContext.productReviewsData.get(productData.pubkey) !=
        "undefined"
    ) {
      const merchantScoresMap = reviewsContext.merchantReviewsData;
      const productReviewScore = reviewsContext.productReviewsData.get(
        productData.pubkey
      );
      if (merchantScoresMap && productReviewScore) {
        for (const [productPubkey, scores] of merchantScoresMap.entries()) {
          if (productPubkey === productData.pubkey) {
            const averageScore =
              scores.reduce((a, b) => a + b, 0) / scores.length;
            setMerchantReview(averageScore);
          }
        }
        const productReviewValue = productData.d
          ? productReviewScore.get(productData.d)
          : undefined;
        setProductReviews(
          productReviewValue !== undefined
            ? productReviewValue
            : new Map<string, string[][]>()
        );
      }
    }
    setIsFetchingReviews(false);
  }, [productData.pubkey, reviewsContext, productData.d]);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          calculateVisibleImages(entry.contentRect.height);
        }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
    return;
  }, [selectedImage]);

  useEffect(() => {
    setHasSizes(
      !!(
        productData.sizes &&
        productData.sizes.length > 0 &&
        productData.sizes.some(
          (size) => (productData.sizeQuantities?.get(size) || 0) > 0
        )
      )
    );
  }, [productData.sizes, productData.sizeQuantities]);

  useEffect(() => {
    if (!reviewsContext.merchantReviewsData.has(productData.pubkey)) {
      setMerchantQuality("");
    } else if (merchantReview >= 0.75) {
      setMerchantQuality("Trustworthy");
    } else if (merchantReview >= 0.5) {
      setMerchantQuality("Solid");
    } else if (merchantReview >= 0.25) {
      setMerchantQuality("Questionable");
    } else {
      setMerchantQuality("Don't trust, don't bother verifying");
    }
  }, [reviewsContext, merchantReview, productData.pubkey]);

  const toggleBuyNow = () => {
    if (isLoggedIn) {
      setIsBeingPaid(!isBeingPaid);
    } else {
      onOpen();
    }
  };

  const handleAddToCart = () => {
    if (isLoggedIn) {
      if (
        !currencySelection.hasOwnProperty(productData.currency.toUpperCase()) ||
        productData.totalCost < 1
      ) {
        setFailureText(
          "The price and/or currency set for this listing was invalid."
        );
        setShowFailureModal(true);
        return;
      }
      let updatedCart = [];
      if (selectedSize) {
        const productWithSize = { ...productData, selectedSize: selectedSize };
        updatedCart = [...cart, productWithSize];
      } else {
        updatedCart = [...cart, productData];
      }
      setCart(updatedCart);
      localStorage.setItem("cart", JSON.stringify(updatedCart));
    } else {
      onOpen();
    }
  };

  const handleShare = async () => {
    const naddr = nip19.naddrEncode({
      identifier: productData.d as string,
      pubkey: productData.pubkey,
      kind: 30402,
    });
    // The content you want to share
    const shareData = {
      title: productData.title,
      url: `${window.location.origin}/listing/${naddr}`,
    };
    // Check if the Web Share API is available
    if (navigator.share) {
      // Use the share API
      await navigator.share(shareData);
    } else {
      // Fallback for browsers that do not support the Web Share API
      navigator.clipboard.writeText(
        `${window.location.origin}/listing/${naddr}`
      );
      setShowSuccessModal(true);
    }
  };

  const handleSendMessage = (pubkeyToOpenChatWith: string) => {
    if (isLoggedIn) {
      router.push({
        pathname: "/orders",
        query: { pk: nip19.npubEncode(pubkeyToOpenChatWith), isInquiry: true },
      });
    } else {
      onOpen();
    }
  };

  const renderSizeGrid = () => {
    return (
      <div className="grid grid-cols-3 gap-2 py-1">
        {productData.sizes?.map((size) =>
          (productData.sizeQuantities?.get(size) || 0) > 0 ? (
            <button
              key={size}
              className={`rounded-md border p-2 text-sm ${
                selectedSize === size
                  ? "bg-black text-white"
                  : "border-black bg-white text-black"
              }`}
              onClick={() => setSelectedSize(size)}
            >
              {size}
            </button>
          ) : null
        )}
      </div>
    );
  };

  return (
    <>
      {!isBeingPaid ? (
        <>
          <div className="max-w-screen pt-4">
            <div
              className="max-w-screen mx-3 my-3 flex flex-row whitespace-normal break-words"
              key={uniqueKey}
            >
              <div className="w-1/2 pr-4">
                <div className="flex w-full flex-row">
                  <div className="flex w-1/4 flex-col pr-4">
                    <div ref={containerRef} className="flex-1 overflow-hidden">
                      <div
                        className={`flex flex-col space-y-2 ${
                          showAllImages ? "overflow-y-auto" : ""
                        }`}
                      >
                        {(showAllImages
                          ? productData.images
                          : visibleImages
                        ).map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Product image ${index + 1}`}
                            className={`w-full cursor-pointer rounded-xl object-cover ${
                              image === selectedImage
                                ? "border-2 border-dark-bg"
                                : ""
                            }`}
                            style={{ aspectRatio: "1 / 1" }}
                            onClick={() => setSelectedImage(image)}
                          />
                        ))}
                      </div>
                    </div>
                    {productData.images.length > visibleImages.length && (
                      <button
                        onClick={() => setShowAllImages(!showAllImages)}
                        className="hover:text-black-500 mt-2 text-sm text-black"
                      >
                        {showAllImages ? "∧" : "∨"}
                      </button>
                    )}
                  </div>
                  <div className="w-3/4">
                    <img
                      src={selectedImage}
                      alt="Selected product image"
                      className="w-full rounded-xl object-cover"
                      style={{ aspectRatio: "1 / 1" }}
                    />
                  </div>
                </div>
              </div>
              <div className="w-1/2 px-3">
                <div className="flex w-full flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <ProfileWithDropdown
                      pubkey={productData.pubkey}
                      dropDownKeys={
                        productData.pubkey === userPubkey
                          ? ["shop_profile"]
                          : ["shop", "inquiry", "copy_npub"]
                      }
                      bg="light"
                    />
                    {merchantQuality !== "" && (
                      <div className="inline-flex items-center gap-1 rounded-lg border-2 border-black px-2">
                        {merchantReview >= 0.5 ? (
                          <>
                            <FaceSmileIcon
                              className={`h-10 w-10 p-1 ${
                                merchantReview >= 0.75
                                  ? "text-green-500"
                                  : "text-green-300"
                              }`}
                            />
                            <span className="mr-2 whitespace-nowrap text-sm text-light-text">
                              {merchantQuality}
                            </span>
                          </>
                        ) : (
                          <>
                            <FaceFrownIcon
                              className={`h-10 w-10 p-1 ${
                                merchantReview >= 0.25
                                  ? "text-red-300"
                                  : "text-red-500"
                              }`}
                            />
                            <span className="mr-2 whitespace-nowrap text-sm text-light-text">
                              {merchantQuality}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <h2 className="mt-4 w-full text-left text-2xl font-bold text-light-text">
                  {productData.title}
                </h2>
                {productData.condition && (
                  <div className="text-left text-xs text-light-text">
                    <span>Condition: {productData.condition}</span>
                  </div>
                )}
                {productData.restrictions && (
                  <div className="text-left text-xs text-light-text">
                    <span>Restrictions: </span>
                    <span className="text-red-500">
                      {productData.restrictions}
                    </span>
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="mt-4 w-full text-left text-lg text-light-text">
                    {renderSummary()}
                  </p>
                  {productData.summary.length > SUMMARY_CHARACTER_LIMIT && (
                    <button
                      onClick={toggleExpand}
                      className="mt-2 text-gray-500 hover:text-light-text"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <DisplayCheckoutCost monetaryInfo={productData} />
                </div>
                <div className="pb-1">
                  <Chip
                    key={productData.location}
                    startContent={locationAvatar(productData.location)}
                  >
                    {productData.location}
                  </Chip>
                </div>
                {renderSizeGrid()}
                <div className="flex w-full flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {productData.status !== "sold" ? (
                      <>
                        <Button
                          className={`min-w-fit bg-gradient-to-tr from-yellow-700 via-yellow-500 to-yellow-700 text-light-text shadow-lg ${
                            hasSizes && !selectedSize
                              ? "cursor-not-allowed opacity-50"
                              : ""
                          }`}
                          onClick={toggleBuyNow}
                          disabled={hasSizes && !selectedSize}
                        >
                          Buy Now
                        </Button>
                        <Button
                          className={`${BLACKBUTTONCLASSNAMES} ${
                            isAdded || (hasSizes && !selectedSize)
                              ? "cursor-not-allowed opacity-50"
                              : ""
                          }`}
                          onClick={handleAddToCart}
                          disabled={isAdded || (hasSizes && !selectedSize)}
                        >
                          Add To Cart
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className={`${BLACKBUTTONCLASSNAMES} cursor-not-allowed opacity-50`}
                          disabled
                        >
                          Sold Out
                        </Button>
                      </>
                    )}
                    <Button
                      type="submit"
                      className={BLACKBUTTONCLASSNAMES}
                      onClick={handleShare}
                    >
                      Share
                    </Button>
                  </div>
                </div>
                {productData.pubkey !== userPubkey && (
                  <span
                    onClick={() => {
                      handleSendMessage(productData.pubkey);
                    }}
                    className="cursor-pointer text-gray-500"
                  >
                    or{" "}
                    <span className="underline hover:text-light-text">
                      contact
                    </span>{" "}
                    seller
                  </span>
                )}
              </div>
            </div>
            <div className="max-w-screen mx-3 my-3 max-w-full overflow-hidden whitespace-normal break-words sm:hidden">
              <p className="break-words-all w-full text-left text-lg text-light-text">
                {renderSummary()}
              </p>
              {productData.summary.length > SUMMARY_CHARACTER_LIMIT && (
                <button
                  onClick={toggleExpand}
                  className="mt-2 text-gray-500 hover:text-light-text"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
            {!isFetchingReviews && productReviews && (
              <div className="mt-4 max-w-full p-4 pt-4">
                <h3 className="mb-3 text-lg font-semibold text-light-text">
                  Product Reviews
                </h3>
                {productReviews.size > 0 ? (
                  <div className="space-y-3">
                    {Array.from(productReviews.entries()).map(
                      ([reviewerPubkey, reviewData]) => (
                        <div
                          key={reviewerPubkey}
                          className="rounded-lg border-2 border-black p-3"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <ProfileWithDropdown
                              pubkey={reviewerPubkey}
                              dropDownKeys={
                                reviewerPubkey === userPubkey
                                  ? ["shop_profile"]
                                  : ["shop", "inquiry", "copy_npub"]
                              }
                              bg="light"
                            />
                          </div>
                          <div className="flex flex-col">
                            <div className="mb-1 flex flex-wrap gap-2">
                              {reviewData.map(([_, value, category], index) => {
                                if (category === undefined) {
                                  // Don't render the comment here; we'll show it later.
                                  return null;
                                } else if (category === "thumb") {
                                  return (
                                    <Chip
                                      key={index}
                                      className={`text-light-textt ${
                                        value === "1"
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                      }`}
                                    >
                                      {`overall: ${
                                        value === "1" ? "👍" : "👎"
                                      }`}
                                    </Chip>
                                  );
                                } else {
                                  // Render chips for other categories
                                  return (
                                    <Chip
                                      key={index}
                                      className={`text-light-text ${
                                        value === "1"
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                      }`}
                                    >
                                      {`${category}: ${
                                        value === "1" ? "👍" : "👎"
                                      }`}
                                    </Chip>
                                  );
                                }
                              })}
                            </div>
                            {reviewData.map(([category, value], index) => {
                              if (category === "comment" && value !== "") {
                                // Render the comment text below the chips
                                return (
                                  <p
                                    key={index}
                                    className="italic text-light-text"
                                  >
                                    &ldquo;{value}&rdquo;
                                  </p>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="w-full max-w-xl rounded-lg bg-dark-fg p-10 text-center shadow-lg">
                      <span className="block text-5xl text-dark-text">
                        No reviews . . . yet!
                      </span>
                      <div className="flex flex-col items-center justify-center gap-3 pt-5 opacity-80">
                        <span className="text-2xl text-dark-text">
                          Be the first to leave a review!
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="p-4 text-light-text">
            <h2 className="mb-4 text-2xl font-bold">{productData.title}</h2>
            {selectedSize && (
              <p className="mb-4 text-lg">Size: {selectedSize}</p>
            )}
            <DisplayCostBreakdown monetaryInfo={productData} />
            <div className="mx-4 mt-2 flex items-center justify-center text-center">
              <InformationCircleIcon className="h-6 w-6 text-light-text" />
              <p className="ml-2 text-xs text-light-text">
                Once purchased, the seller will receive a DM with your order
                details.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <ProductInvoiceCard
              productData={productData}
              setFiatOrderIsPlaced={setFiatOrderIsPlaced}
              setInvoiceIsPaid={setInvoiceIsPaid}
              setInvoiceGenerationFailed={setInvoiceGenerationFailed}
              setCashuPaymentSent={setCashuPaymentSent}
              setCashuPaymentFailed={setCashuPaymentFailed}
              selectedSize={selectedSize}
            />
          </div>
        </>
      )}
      <SignInModal isOpen={isOpen} onClose={onClose} />
      <FailureModal
        bodyText={failureText}
        isOpen={showFailureModal}
        onClose={() => setShowFailureModal(false)}
      />
      <SuccessModal
        bodyText="Listing URL copied to clipboard!"
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
    </>
  );
}

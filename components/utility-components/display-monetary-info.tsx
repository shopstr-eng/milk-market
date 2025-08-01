import React from "react";
import { ShippingOptionsType } from "@/utils/STATIC-VARIABLES";

type ProductMonetaryInfo = {
  shippingType?: ShippingOptionsType;
  shippingCost?: number;
  price: number;
  currency: string;
};

export default function CompactPriceDisplay({
  monetaryInfo,
}: {
  monetaryInfo: ProductMonetaryInfo;
}) {
  const { shippingType, shippingCost, price, currency } = monetaryInfo;

  const getShippingLabel = () => {
    if (shippingType === "Added Cost")
      return `+ ${formatter.format(Number(shippingCost))} ${currency} Shipping`;
    else if (shippingType === "Free") return "- Free Shipping";
    else if (shippingType === "Pickup") return "- Pickup Only";
    else if (shippingType == "Free/Pickup") return "- Free / Pickup";
    else return "";
  };

  const formatter = new Intl.NumberFormat("en-GB", {
    notation: "compact",
    compactDisplay: "short",
  });
  return (
    <div className=" inline-block h-[30px] max-w-[70%] overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-black px-3 text-cyan-50 opacity-50">
      <span className="font-semibold ">
        {formatter.format(Number(price))} {currency}{" "}
        {monetaryInfo.shippingType ? getShippingLabel() : ""}{" "}
      </span>
    </div>
  );
}

export function DisplayCheckoutCost({
  monetaryInfo,
}: {
  monetaryInfo: ProductMonetaryInfo;
}) {
  const { shippingType, price, currency } = monetaryInfo;

  const formattedPrice = formatWithCommas(price, currency);

  return (
    <div>
      <p className="text-lg font-semibold text-light-text">{formattedPrice}</p>
      {shippingType && (
        <p className="mb-4 text-sm text-light-text">Shipping: {shippingType}</p>
      )}
    </div>
  );
}

export const calculateTotalCost = (
  productMonetaryInfo: ProductMonetaryInfo
) => {
  const { price, shippingCost } = productMonetaryInfo;
  let total = price;
  total += shippingCost ? shippingCost : 0;
  return total;
};

export function formatWithCommas(amount: number, currency: string) {
  if (!amount || amount === 0) {
    // If the amount is 0, directly return "0" followed by the currency
    return `0 ${currency}`;
  }
  const [integerPart, fractionalPart] = amount.toString().split(".");
  // Add commas to the integer part
  const integerWithCommas = integerPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // Concatenate the fractional part if it exists
  const formattedAmount = fractionalPart
    ? `${integerWithCommas}.${fractionalPart}`
    : integerWithCommas;
  return `${formattedAmount} ${currency}`;
}

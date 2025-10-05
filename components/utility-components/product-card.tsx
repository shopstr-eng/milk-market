import React, { useContext } from "react";
import { Chip } from "@nextui-org/react";
import Link from "next/link";
import { locationAvatar } from "./dropdowns/location-dropdown";
import ImageCarousel from "./image-carousel";
import CompactPriceDisplay from "./display-monetary-info";
import { ProductData } from "@/utils/parsers/product-parser-functions";
import { ProfileWithDropdown } from "./profile/profile-dropdown";
import { useRouter } from "next/router";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";

export default function ProductCard({
  productData,
  onProductClick,
  href,
}: {
  productData: ProductData;
  onProductClick?: (productId: ProductData, e?: React.MouseEvent) => void;
  href?: string | null;
}) {
  const router = useRouter();
  const { pubkey: userPubkey } = useContext(SignerContext);
  if (!productData) return null;

  const cardHoverStyle = "hover:shadow-yellow-700/30 hover:scale-[1.01]";

  const content = (
    <div
      className="cursor-pointer"
      onClick={() => {
        onProductClick && onProductClick(productData);
      }}
    >
      <div>
        <ImageCarousel
          images={productData.images}
          classname="w-full h-[300px] rounded-t-2xl"
          showThumbs={false}
        />
      </div>
      <div className="flex flex-col p-4">
        {router.pathname !== "/" && (
          <div className="mb-2 flex items-center justify-between">
            <h2 className="max-w-[70%] truncate text-xl font-semibold text-light-text">
              {productData.title}
            </h2>
            {productData.status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-900 px-2 py-0.5 text-xs font-medium text-green-300">
                Active
              </span>
            )}
            {productData.status === "sold" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-900 px-2 py-0.5 text-xs font-medium text-red-300">
                Sold
              </span>
            )}
          </div>
        )}
        <div className="mb-3">
          <ProfileWithDropdown
            pubkey={productData.pubkey}
            dropDownKeys={
              productData.pubkey === userPubkey
                ? ["shop_profile"]
                : ["shop", "inquiry", "copy_npub"]
            }
          />
        </div>
        {router.pathname !== "/" && (
          <div className="mt-1 flex items-center justify-between">
            <Chip
              key={productData.location}
              startContent={locationAvatar(productData.location)}
              className="text-xs"
            >
              {productData.location}
            </Chip>
            <CompactPriceDisplay monetaryInfo={productData} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`${cardHoverStyle} mx-2 my-4 rounded-2xl border-2 border-black bg-white shadow-md duration-300 transition-all`}
    >
      <div className="w-80 overflow-hidden rounded-2xl">
        {href ? (
          <Link href={href} className="block">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

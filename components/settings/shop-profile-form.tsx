import React, { useEffect, useState, useContext } from "react";
import { useRouter } from "next/router";
import { useForm, Controller } from "react-hook-form";
import { Button, Textarea, Input, Image } from "@nextui-org/react";

import { ShopMapContext } from "@/utils/context/context";
import {
  BLACKBUTTONCLASSNAMES,
  WHITEBUTTONCLASSNAMES,
} from "@/utils/STATIC-VARIABLES";
import {
  SignerContext,
  NostrContext,
} from "@/components/utility-components/nostr-context-provider";
import { createNostrShopEvent } from "@/utils/nostr/nostr-helper-functions";
import { FileUploaderButton } from "@/components/utility-components/file-uploader";
import MilkMarketSpinner from "@/components/utility-components/mm-spinner";

interface ShopProfileFormProps {
  isOnboarding?: boolean;
}

const ShopProfileForm = ({ isOnboarding = false }: ShopProfileFormProps) => {
  const router = useRouter();
  const { nostr } = useContext(NostrContext);
  const [isUploadingShopProfile, setIsUploadingShopProfile] = useState(false);
  const [isFetchingShop, setIsFetchingShop] = useState(false);

  const { signer, pubkey: userPubkey } = useContext(SignerContext);

  const shopContext = useContext(ShopMapContext);
  const { handleSubmit, control, reset, watch, setValue } = useForm({
    defaultValues: {
      banner: "",
      picture: "",
      name: "",
      about: "",
    },
  });

  const watchBanner = watch("banner");
  const watchPicture = watch("picture");
  const defaultImage = "/milk-market.png";

  useEffect(() => {
    setIsFetchingShop(true);
    const shopMap = shopContext.shopData;

    const shop = shopMap.has(userPubkey!)
      ? shopMap.get(userPubkey!)
      : undefined;
    if (shop) {
      const mappedContent = {
        name: shop.content.name,
        about: shop.content.about,
        picture: shop.content.ui.picture,
        banner: shop.content.ui.banner,
      };
      reset(mappedContent);
    }
    setIsFetchingShop(false);
  }, [shopContext, userPubkey, reset]);

  const onSubmit = async (data: { [x: string]: string }) => {
    setIsUploadingShopProfile(true);
    const transformedData = {
      name: data.name || "",
      about: data.about || "",
      ui: {
        picture: data.picture || "",
        banner: data.banner || "",
        theme: "",
        darkMode: false,
      },
      merchants: [userPubkey!],
    };
    await createNostrShopEvent(
      nostr!,
      signer!,
      userPubkey!,
      JSON.stringify(transformedData)
    );
    shopContext.updateShopData({
      pubkey: userPubkey!,
      content: transformedData,
      created_at: 0,
    });
    setIsUploadingShopProfile(false);

    if (isOnboarding) {
      router.push("/marketplace");
    }
  };

  if (isFetchingShop) {
    return <MilkMarketSpinner />;
  }

  return (
    <>
      <div className="mb-20 h-40 rounded-lg bg-dark-fg">
        <div className="relative flex h-40 items-center justify-center rounded-lg bg-light-bg">
          {watchBanner && (
            <Image
              alt={"Shop banner image"}
              src={watchBanner}
              className="h-40 w-full rounded-lg object-cover object-fill"
            />
          )}
          <FileUploaderButton
            className={`absolute bottom-5 right-5 z-20 border-2 border-white shadow-md ${BLACKBUTTONCLASSNAMES}`}
            imgCallbackOnUpload={(imgUrl) => setValue("banner", imgUrl)}
          >
            Upload Banner
          </FileUploaderButton>
        </div>
        <div className="flex items-center justify-center">
          <div className="relative z-50 mt-[-3rem] h-24 w-24">
            <div className="">
              <FileUploaderButton
                isIconOnly={true}
                className={`absolute bottom-[-0.5rem] right-[-0.5rem] z-20 ${BLACKBUTTONCLASSNAMES}`}
                imgCallbackOnUpload={(imgUrl) => setValue("picture", imgUrl)}
              />
              {watchPicture ? (
                <Image
                  src={watchPicture}
                  alt="shop logo"
                  className="rounded-full"
                />
              ) : (
                <Image
                  src={defaultImage}
                  alt="shop logo"
                  className="rounded-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <Controller
          name="name"
          control={control}
          rules={{
            maxLength: {
              value: 50,
              message: "This input exceed maxLength of 50.",
            },
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => {
            const isErrored = error !== undefined;
            const errorMessage: string = error?.message ? error.message : "";
            return (
              <Input
                className="pb-4 text-dark-text"
                classNames={{
                  label: "text-dark-text text-lg",
                }}
                variant="bordered"
                fullWidth={true}
                label="Shop Name"
                labelPlacement="outside"
                isInvalid={isErrored}
                errorMessage={errorMessage}
                placeholder="Add your shop's name . . ."
                onChange={onChange}
                onBlur={onBlur}
                value={value}
              />
            );
          }}
        />

        <Controller
          name="about"
          control={control}
          rules={{
            maxLength: {
              value: 500,
              message: "This input exceed maxLength of 500.",
            },
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => {
            const isErrored = error !== undefined;
            const errorMessage: string = error?.message ? error.message : "";
            return (
              <Textarea
                className="pb-4 text-dark-text"
                classNames={{
                  label: "text-dark-text text-lg",
                }}
                variant="bordered"
                fullWidth={true}
                placeholder="Add something about your shop . . ."
                isInvalid={isErrored}
                errorMessage={errorMessage}
                label="About"
                labelPlacement="outside"
                onChange={onChange}
                onBlur={onBlur}
                value={value}
              />
            );
          }}
        />

        <Button
          className={`mb-10 w-full ${WHITEBUTTONCLASSNAMES}`}
          type="submit"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit(onSubmit as any)();
            }
          }}
          isDisabled={isUploadingShopProfile}
          isLoading={isUploadingShopProfile}
        >
          Save Shop
        </Button>
      </form>
    </>
  );
};

export default ShopProfileForm;

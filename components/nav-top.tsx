import React, { useContext, useEffect, useState } from "react";
import useNavigation from "@/components/hooks/use-navigation";
import { Button, Image, useDisclosure } from "@nextui-org/react";
import { Bars4Icon } from "@heroicons/react/24/outline";
import { countNumberOfUnreadMessagesFromChatsContext } from "@/utils/messages/utils";
import { ChatsContext, ShopMapContext } from "@/utils/context/context";
import { db } from "@/utils/nostr/cache-service";
import { useLiveQuery } from "dexie-react-hooks";
import { SignerContext } from "@/components/utility-components/nostr-context-provider";
import { useRouter } from "next/router";
import SignInModal from "./sign-in/SignInModal";
import { ProfileWithDropdown } from "./utility-components/profile/profile-dropdown";
import { ShopProfile } from "../utils/types/types";

const TopNav = ({
  setFocusedPubkey,
  setSelectedSection,
}: {
  setFocusedPubkey: (value: string) => void;
  setSelectedSection: (value: string) => void;
}) => {
  const {
    isHomeActive,
    isMessagesActive,
    isWalletActive,
    isMyListingsActive,
    isProfileActive,
    isCommunitiesActive,
  } = useNavigation();
  const router = useRouter();

  const chatsContext = useContext(ChatsContext);
  const shopMapContext = useContext(ShopMapContext);

  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [cartQuantity, setCartQuantity] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isLoggedIn: signedIn, pubkey: userPubkey } =
    useContext(SignerContext);

  const [shopLogoURL, setShopLogoURL] = useState("");
  const [shopName, setShopName] = useState("");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const liveChatMessagesFromCache = useLiveQuery(async () => {
    if (db) {
      await db.table("chatMessages").toArray();
    }
  });

  useEffect(() => {
    const fetchAndUpdateCartQuantity = async () => {
      const cartList = localStorage.getItem("cart")
        ? JSON.parse(localStorage.getItem("cart") as string)
        : [];
      if (cartList) {
        setCartQuantity(cartList.length);
      }
    };

    fetchAndUpdateCartQuantity();

    const interval = setInterval(() => {
      fetchAndUpdateCartQuantity();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const getUnreadMessages = async () => {
      const unreadMsgCount = await countNumberOfUnreadMessagesFromChatsContext(
        chatsContext.chatsMap
      );
      setUnreadMsgCount(unreadMsgCount);
    };
    getUnreadMessages();
  }, [chatsContext, liveChatMessagesFromCache]);

  useEffect(() => {
    const npub = router.pathname
      .split("/")
      .find((segment) => segment.includes("npub"));
    if (
      npub &&
      shopMapContext.shopData.has(npub) &&
      typeof shopMapContext.shopData.get(npub) != "undefined"
    ) {
      const shopProfile: ShopProfile | undefined =
        shopMapContext.shopData.get(npub);
      if (shopProfile) {
        setShopLogoURL(shopProfile.content.ui.picture);
        setShopName(shopProfile.content.name);
      }
    } else if (
      router.pathname.includes("my-listings") &&
      userPubkey &&
      shopMapContext.shopData.has(userPubkey) &&
      typeof shopMapContext.shopData.get(userPubkey) != "undefined"
    ) {
      const shopProfile: ShopProfile | undefined =
        shopMapContext.shopData.get(userPubkey);
      if (shopProfile) {
        setShopLogoURL(shopProfile.content.ui.picture);
        setShopName(shopProfile.content.name);
      }
    } else {
      setShopLogoURL("");
      setShopName("");
    }
  }, [router.pathname, shopMapContext, userPubkey]);

  const handleRoute = (path: string) => {
    if (signedIn) {
      router.push(path);
      setIsMobileMenuOpen(false);
    } else {
      onOpen();
    }
  };

  const handleHomeClick = () => {
    setFocusedPubkey("");
    setSelectedSection("");
    router.push("/marketplace");
    setIsMobileMenuOpen(false);
  };

  const MobileMenu = () => (
    <div className="absolute left-0 top-full w-full border-t border-black bg-primary-blue shadow-lg">
      <Button
        className={`w-full bg-transparent ${
          isHomeActive ? "text-primary-yellow" : "text-white"
        } hover:text-primary-yellow`}
        onClick={handleHomeClick}
      >
        Marketplace
      </Button>
      <Button
        className={`w-full bg-transparent ${
          isCommunitiesActive ? "text-primary-yellow" : "text-white"
        } hover:text-primary-yellow`}
        onClick={() => router.push("/communities")}
      >
        Communities
      </Button>
      <Button
        className={`w-full bg-transparent ${
          isMessagesActive ? "text-primary-yellow" : "text-white"
        } hover:text-primary-yellow`}
        onClick={() => handleRoute("/orders")}
      >
        Orders {unreadMsgCount > 0 && `(${unreadMsgCount})`}
      </Button>
      <Button
        className={`w-full bg-transparent ${
          isWalletActive ? "text-primary-yellow" : "text-white"
        } hover:text-primary-yellow`}
        onClick={() => handleRoute("/wallet")}
      >
        Wallet
      </Button>
      <Button
        className={`w-full bg-transparent ${
          isMyListingsActive ? "text-primary-yellow" : "text-white"
        } hover:text-primary-yellow`}
        onClick={() => handleRoute("/my-listings")}
      >
        My Listings
      </Button>
      <Button
        className={`w-full bg-transparent ${
          router.pathname === "/cart" ? "text-primary-yellow" : "text-white"
        } hover:text-primary-yellow`}
        onClick={() => handleRoute("/cart")}
      >
        Cart {cartQuantity > 0 && `(${cartQuantity})`}
      </Button>
    </div>
  );

  return (
    <div className="fixed top-0 z-50 w-full border-b-2 border-black bg-primary-blue shadow-lg">
      <div className="flex items-center justify-between py-2 pr-4">
        <div className="flex items-center">
          <Button
            onClick={handleHomeClick}
            className="flex items-center bg-transparent text-white duration-200 hover:text-primary-yellow"
          >
            <Image
              alt="Milk Market logo"
              height={40}
              radius="sm"
              src={shopLogoURL != "" ? shopLogoURL : "/milk-market.png"}
              width={40}
            />
            <span className="ml-2 text-xl text-white md:flex">
              {shopName != "" ? shopName : "Milk Market"}
            </span>
          </Button>
        </div>
        <div className="flex flex-row items-center md:hidden">
          <Button
            className="bg-transparent"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Bars4Icon className="h-6 w-6 text-white" />
          </Button>
          {signedIn ? (
            <ProfileWithDropdown
              pubkey={userPubkey!}
              baseClassname="w-full hover:bg-opacity-80 rounded-3xl hover:scale-105 hover:shadow-lg"
              dropDownKeys={[
                "shop_profile",
                "user_profile",
                "settings",
                "logout",
              ]}
              nameClassname="md:block text-white"
              bg="dark"
            />
          ) : (
            <Button
              onClick={onOpen}
              className="w-full bg-transparent text-white hover:text-primary-yellow"
            >
              Sign In
            </Button>
          )}
        </div>
        <div className="hidden items-center space-x-2 font-bold md:flex">
          <Button
            className={`bg-transparent ${
              isHomeActive ? "text-primary-yellow" : "text-white"
            } hover:text-primary-yellow`}
            onClick={handleHomeClick}
          >
            Marketplace
          </Button>
          <span className="text-white">|</span>
          <Button
            className={`bg-transparent ${
              isCommunitiesActive ? "text-primary-yellow" : "text-white"
            } hover:text-primary-yellow`}
            onClick={() => handleRoute("/communities")}
          >
            Communities
          </Button>
          <span className="text-white">|</span>
          <Button
            className={`bg-transparent ${
              isMessagesActive ? "text-primary-yellow" : "text-white"
            } hover:text-primary-yellow`}
            onClick={() => handleRoute("/orders")}
          >
            Orders {unreadMsgCount > 0 && `(${unreadMsgCount})`}
          </Button>
          <span className="text-white">|</span>
          <Button
            className={`bg-transparent ${
              isWalletActive ? "text-primary-yellow" : "text-white"
            } hover:text-primary-yellow`}
            onClick={() => handleRoute("/wallet")}
          >
            Wallet
          </Button>
          <span className="text-white">|</span>
          <Button
            className={`bg-transparent ${
              isMyListingsActive ? "text-primary-yellow" : "text-white"
            } hover:text-primary-yellow`}
            onClick={() => handleRoute("/my-listings")}
          >
            My Listings
          </Button>
          <span className="text-white">|</span>
          <Button
            className={`bg-transparent ${
              router.pathname === "/cart" ? "text-primary-yellow" : "text-white"
            } hover:text-primary-yellow`}
            onClick={() => handleRoute("/cart")}
          >
            Cart {cartQuantity > 0 && `(${cartQuantity})`}
          </Button>
          <span className="text-white">|</span>
          {signedIn ? (
            <>
              <ProfileWithDropdown
                pubkey={userPubkey!}
                baseClassname="justify-start hover:bg-opacity-80 rounded-3xl py-2 hover:scale-105 hover:shadow-lg"
                dropDownKeys={[
                  "shop_profile",
                  "user_profile",
                  "settings",
                  "logout",
                ]}
                nameClassname="md:block text-white"
                bg="dark"
              />
            </>
          ) : (
            <>
              <Button
                onClick={onOpen}
                className={`bg-transparent ${
                  isProfileActive ? "text-primary-yellow" : "text-white"
                } duration-200 hover:text-primary-yellow`}
              >
                Sign In
              </Button>
            </>
          )}
        </div>
      </div>
      {isMobileMenuOpen && <MobileMenu />}
      <SignInModal isOpen={isOpen} onClose={onClose} />
    </div>
  );
};

export default TopNav;

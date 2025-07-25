import React from "react";
import { useRouter } from "next/router";
import { Card, CardBody, Button, Image } from "@nextui-org/react";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { WHITEBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";
import UserProfileForm from "@/components/settings/user-profile-form";

const OnboardingUserProfile = () => {
  const router = useRouter();

  const handleNext = () => {
    router.push("/onboarding/shop-profile");
  };

  return (
    <div className="flex h-[100vh] flex-col bg-light-bg pt-24">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Card className="bg-dark-fg">
          <CardBody>
            <div className="mb-4 flex flex-row items-center justify-center">
              <Image
                alt="Milk Market logo"
                height={50}
                radius="sm"
                src="/milk-market.png"
                width={50}
              />
              <h1 className="cursor-pointer text-center text-3xl font-bold text-dark-text">
                Milk Market
              </h1>
            </div>
            <div className="mb-4 text-center">
              <h2 className="text-2xl font-bold text-dark-text">
                Step 2: Set Up Your Profile
              </h2>
              <p className="text-dark-text">
                Set up your user profile or skip this step to continue.
              </p>
            </div>

            <UserProfileForm isOnboarding={true} />

            <div className="flex justify-center">
              <Button className={WHITEBUTTONCLASSNAMES} onClick={handleNext}>
                Next <ArrowLongRightIcon className="h-5 w-5" />
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingUserProfile;

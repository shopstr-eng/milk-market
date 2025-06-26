import React from "react";
import { Button } from "@nextui-org/react";
import { ArrowLongLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import Link from "next/link";
import { BLACKBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";

export default function Custom404() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-light-bg px-4">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-9xl font-bold text-light-text">404</h1>
        <h2 className="mb-6 text-2xl font-medium text-light-text md:text-3xl">
          Page Not Found
        </h2>
        <p className="mb-8 text-light-text">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
          <Button
            className={BLACKBUTTONCLASSNAMES}
            onClick={() => router.back()}
            startContent={<ArrowLongLeftIcon className="h-5 w-5" />}
          >
            Go back
          </Button>
          <Link href="/" passHref>
            <Button className={BLACKBUTTONCLASSNAMES}>View landing page</Button>
          </Link>
          <Link href="/marketplace" passHref>
            <Button className={BLACKBUTTONCLASSNAMES}>View marketplace</Button>
          </Link>
          <Link href="/orders" passHref>
            <Button className={BLACKBUTTONCLASSNAMES}>View orders</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

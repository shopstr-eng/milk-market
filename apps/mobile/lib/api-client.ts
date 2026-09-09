import {
  createMilkMarketApiClient,
  createSellerOrdersApiClient,
  createSellerShippingApiClient,
} from "@milk-market/api-client";

import { getApiBaseUrl } from "@/lib/api-base-url";

export const mobileApiClient = createMilkMarketApiClient({
  baseUrl: getApiBaseUrl(),
});

export const mobileSellerOrdersApiClient = createSellerOrdersApiClient({
  baseUrl: getApiBaseUrl(),
});

export const mobileSellerShippingApiClient = createSellerShippingApiClient({
  baseUrl: getApiBaseUrl(),
});

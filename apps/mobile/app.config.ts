import type { ExpoConfig } from "expo/config";
// Expo evaluates this config in Node; the explicit extension allows Node 22
// to load the shared, dependency-free TypeScript validator.
const { resolveMobileApiBaseUrl } =
  require("./lib/api-configuration.ts") as typeof import("./lib/api-configuration");

const variant = process.env.MOBILE_APP_VARIANT ?? "development";
const release = variant === "staging" || variant === "production";
const projectId = process.env.EAS_PROJECT_ID;
if (release) {
  resolveMobileApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, "ios", false);
  if (
    !projectId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      projectId
    )
  )
    throw new Error("Configure EAS_PROJECT_ID for this build.");
}
const bundleId =
  variant === "staging"
    ? "com.milkmarket.mobile.staging"
    : "com.milkmarket.mobile";
const config: ExpoConfig = {
  name: variant === "staging" ? "Milk Market Staging" : "Milk Market Vendor",
  extra: { ...(projectId ? { eas: { projectId } } : {}), appVariant: variant },
  slug: "milk-market-mobile",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "milkmarket",
  userInterfaceStyle: "automatic",
  plugins: [
    "expo-router",
    [
      "expo-dev-client",
      {
        launchMode: "most-recent",
      },
    ],
    "expo-secure-store",
    [
      "expo-notifications",
      {
        defaultChannel: "seller-activity",
        enableBackgroundRemoteNotifications: true,
      },
    ],
    "expo-web-browser",
  ],
  experiments: {
    typedRoutes: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
  },
  android: {
    package: bundleId,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  web: {
    bundler: "metro",
  },
};

export default config;

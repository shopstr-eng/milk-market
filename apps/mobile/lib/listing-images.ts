import * as DocumentPicker from "expo-document-picker";

import { uploadSellerListingMedia } from "@milk-market/nostr";
import type { SellerSession } from "@milk-market/domain";

import { getApiBaseUrl } from "@/lib/api-base-url";

function createUploadFileName(
  asset: DocumentPicker.DocumentPickerAsset,
  index: number
): string {
  if (asset.name?.trim()) {
    return asset.name.trim();
  }

  const extension = asset.mimeType?.split("/")[1] ?? "jpg";
  return `listing-image-${Date.now()}-${index}.${extension}`;
}

export async function pickAndUploadSellerListingImages(
  session: SellerSession
): Promise<string[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return [];
  }

  const uploadedUrls: string[] = [];

  for (const [index, asset] of result.assets.entries()) {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error("Selected image could not be read from the device.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const uploaded = await uploadSellerListingMedia({
      baseUrl: getApiBaseUrl(),
      session,
      fileName: createUploadFileName(asset, index),
      mimeType: asset.mimeType ?? "image/jpeg",
      bytes: new Uint8Array(arrayBuffer),
    });
    uploadedUrls.push(uploaded.url);
  }

  return uploadedUrls;
}

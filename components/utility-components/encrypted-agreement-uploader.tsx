import React, { useState, useContext } from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { SignerContext } from "./nostr-context-provider";
import {
  getLocalStorageData,
  blossomUpload,
} from "@/utils/nostr/nostr-helper-functions";
import { encryptFileWithNip44 } from "@/utils/encryption/file-encryption";
import { viewEncryptedAgreement } from "@/utils/encryption/agreement-viewer";

interface EncryptedAgreementUploaderButtonProps {
  children: React.ReactNode;
  fileCallbackOnUpload: (fileUrl: string) => void;
  sellerNpub: string; // Can be npub or hex pubkey
}

export function EncryptedAgreementUploaderButton({
  children,
  fileCallbackOnUpload,
  sellerNpub,
}: EncryptedAgreementUploaderButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { signer } = useContext(SignerContext);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file only.");
      return;
    }

    setIsUploading(true);

    try {
      // Encrypt the file before uploading
      const encryptedFile = await encryptFileWithNip44(
        file,
        sellerNpub,
        false,
        signer
      );

      // Get blossom servers from local storage
      const { blossomServers } = getLocalStorageData();

      // Upload the encrypted file
      const uploadTags = await blossomUpload(
        encryptedFile,
        false, // isImage = false for PDF
        signer!,
        blossomServers
      );

      // Extract the URL from the upload tags
      const urlTag = uploadTags.find((tag) => tag[0] === "url");
      if (urlTag && urlTag[1]) {
        setUploadedFileUrl(urlTag[1]);
        setUploadedFileName(file.name);
        fileCallbackOnUpload(urlTag[1]);
      } else {
        throw new Error("Failed to get upload URL");
      }
    } catch (error) {
      console.error("Error uploading encrypted file:", error);
      alert("Failed to upload encrypted agreement. Please try again.");
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = "";
    }
  };

  const handlePreviewAgreement = async () => {
    if (!uploadedFileUrl) return;

    setIsLoadingPreview(true);
    try {
      const decryptedBlob = await viewEncryptedAgreement(
        uploadedFileUrl,
        sellerNpub,
        signer
      );
      const url = URL.createObjectURL(decryptedBlob);
      setPreviewUrl(url);
      setShowPreviewModal(true);
    } catch (error) {
      console.error("Error previewing encrypted agreement:", error);
      alert("Failed to preview encrypted agreement. Please try again.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        style={{ display: "none" }}
        id="encrypted-agreement-upload"
      />
      <div className="space-y-2">
        <Button
          as="label"
          htmlFor="encrypted-agreement-upload"
          className="w-full cursor-pointer"
          isLoading={isUploading}
          disabled={isUploading}
        >
          {isUploading ? "Encrypting and uploading..." : children}
        </Button>

        {uploadedFileUrl && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-green-600">
              ✓ Encrypted agreement uploaded: {uploadedFileName}
            </div>
            <Button
              size="sm"
              variant="light"
              color="primary"
              onClick={handlePreviewAgreement}
              isLoading={isLoadingPreview}
              disabled={isLoadingPreview}
              className="w-full"
            >
              {isLoadingPreview ? "Decrypting..." : "Preview Agreement"}
            </Button>
          </div>
        )}
      </div>

      <Modal
        isOpen={showPreviewModal}
        onClose={handleClosePreview}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h3>Agreement Preview</h3>
          </ModalHeader>
          <ModalBody>
            {previewUrl && (
              <div className="h-[600px] w-full">
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="h-full w-full rounded border"
                >
                  <p className="p-4 text-center">
                    Unable to display PDF.
                    <br />
                    <Button
                      size="sm"
                      color="primary"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = previewUrl;
                        link.download = uploadedFileName;
                        link.click();
                      }}
                      className="mt-2"
                    >
                      Download PDF
                    </Button>
                  </p>
                </object>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="light"
              onPress={handleClosePreview}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

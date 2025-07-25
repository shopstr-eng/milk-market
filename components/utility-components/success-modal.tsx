import { Modal, ModalContent, ModalHeader, ModalBody } from "@nextui-org/react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export default function FailureModal({
  bodyText,
  isOpen,
  onClose,
}: {
  bodyText: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <Modal
        backdrop="blur"
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          body: "py-6 bg-light-bg",
          backdrop: "bg-[#292f46]/50 backdrop-opacity-60",
          header: "border-b-[1px] bg-light-bg",
          closeButton: "hover:bg-black/5 active:bg-white/10",
        }}
        isDismissable={true}
        scrollBehavior={"normal"}
        placement={"center"}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader className="flex items-center justify-center text-light-text">
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
            <div className="ml-2">Success</div>
          </ModalHeader>
          <ModalBody className="flex flex-col overflow-hidden text-light-text">
            <div className="flex items-center justify-center">{bodyText}</div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

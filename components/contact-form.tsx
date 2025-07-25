import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
} from "@nextui-org/react";
import {
  Controller,
  Control,
  UseFormHandleSubmit,
  FieldValues,
} from "react-hook-form";
import { BLACKBUTTONCLASSNAMES } from "@/utils/STATIC-VARIABLES";

export default function ContactForm({
  showContactModal,
  handleToggleContactModal,
  handleContactSubmit,
  onContactSubmit,
  contactControl,
  requiredInfo,
}: {
  showContactModal: boolean;
  handleToggleContactModal: () => void;
  handleContactSubmit: UseFormHandleSubmit<FieldValues>;
  onContactSubmit: (data: FieldValues) => void;
  contactControl: Control<FieldValues>;
  requiredInfo?: string;
}) {
  return (
    <Modal
      backdrop="blur"
      isOpen={showContactModal}
      onClose={handleToggleContactModal}
      classNames={{
        body: "py-6",
        backdrop: "bg-[#292f46]/50 backdrop-opacity-60",
        header: "border-b-[1px] border-[#292f46]",
        footer: "border-t-[1px] border-[#292f46]",
        closeButton: "hover:bg-black/5 active:bg-white/10",
      }}
      scrollBehavior={"outside"}
      size="2xl"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 text-dark-text">
          Enter Contact Info
        </ModalHeader>
        <form onSubmit={handleContactSubmit(onContactSubmit)}>
          <ModalBody>
            <Controller
              name="Contact"
              control={contactControl}
              rules={{
                required: "A contact is required.",
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => {
                const isErrored = error !== undefined;
                const errorMessage: string = error?.message
                  ? error.message
                  : "";
                return (
                  <Input
                    className="text-dark-text"
                    autoFocus
                    variant="bordered"
                    fullWidth={true}
                    label="Contact"
                    labelPlacement="inside"
                    placeholder="@milkmarket"
                    isInvalid={isErrored}
                    errorMessage={errorMessage}
                    // controller props
                    onChange={onChange} // send value to hook form
                    onBlur={onBlur} // notify when input is touched/blur
                    value={value}
                  />
                );
              }}
            />

            <Controller
              name="Contact Type"
              control={contactControl}
              rules={{
                required: "A contact type is required.",
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => {
                const isErrored = error !== undefined;
                const errorMessage: string = error?.message
                  ? error.message
                  : "";
                return (
                  <Input
                    className="text-dark-text"
                    autoFocus
                    variant="bordered"
                    fullWidth={true}
                    label="Contact type"
                    labelPlacement="inside"
                    placeholder="Nostr, Signal, Telegram, email, phone, etc."
                    isInvalid={isErrored}
                    errorMessage={errorMessage}
                    // controller props
                    onChange={onChange} // send value to hook form
                    onBlur={onBlur} // notify when input is touched/blur
                    value={value}
                  />
                );
              }}
            />

            <Controller
              name="Instructions"
              control={contactControl}
              rules={{
                required: "Delivery instructions are required.",
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => {
                const isErrored = error !== undefined;
                const errorMessage: string = error?.message
                  ? error.message
                  : "";
                return (
                  <Textarea
                    className="text-dark-text"
                    variant="bordered"
                    fullWidth={true}
                    label="Delivery instructions"
                    labelPlacement="inside"
                    placeholder="Meet me by . . .; Send file to . . ."
                    isInvalid={isErrored}
                    errorMessage={errorMessage}
                    // controller props
                    onChange={onChange} // send value to hook form
                    onBlur={onBlur} // notify when input is touched/blur
                    value={value}
                  />
                );
              }}
            />

            {requiredInfo && requiredInfo !== "" && (
              <Controller
                name="Required"
                control={contactControl}
                rules={{
                  required: "Additional information is required.",
                }}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => {
                  const isErrored = error !== undefined;
                  const errorMessage: string = error?.message
                    ? error.message
                    : "";
                  return (
                    <Input
                      className="text-dark-text"
                      autoFocus
                      variant="bordered"
                      fullWidth={true}
                      label={`Enter ${requiredInfo}`}
                      labelPlacement="inside"
                      isInvalid={isErrored}
                      errorMessage={errorMessage}
                      // controller props
                      onChange={onChange} // send value to hook form
                      onBlur={onBlur} // notify when input is touched/blur
                      value={value}
                    />
                  );
                }}
              />
            )}
          </ModalBody>

          <ModalFooter>
            <Button
              color="danger"
              variant="light"
              onClick={handleToggleContactModal}
            >
              Cancel
            </Button>

            <Button className={BLACKBUTTONCLASSNAMES} type="submit">
              Submit
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

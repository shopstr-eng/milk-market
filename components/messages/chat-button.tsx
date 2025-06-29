import { useEffect, useRef } from "react";
import { ChatObject } from "../../utils/types/types";
import { timeSinceMessageDisplayText } from "../../utils/messages/utils";
import { ProfileAvatar } from "@/components/utility-components/profile/profile-avatar";

const ChatButton = ({
  pubkeyOfChat,
  chatObject,
  openedChatPubkey,
  handleClickChat,
}: {
  pubkeyOfChat: string;
  chatObject: ChatObject;
  openedChatPubkey: string;
  handleClickChat: (pubkey: string) => void;
}) => {
  const messages = chatObject?.decryptedChat;
  const lastMessage =
    messages && messages.length > 0 && messages[messages.length - 1];
  const unreadCount = chatObject?.unreadCount;

  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pubkeyOfChat === openedChatPubkey) {
      divRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [openedChatPubkey]);

  return (
    <div
      key={pubkeyOfChat}
      className={`mx-3 mb-2 flex cursor-pointer items-center gap-4 rounded-md border-2 border-dark-fg px-3 py-2 hover:opacity-70 ${
        pubkeyOfChat === openedChatPubkey ? "bg-[#ccccccb9]" : ""
      }`}
      onClick={() => handleClickChat(pubkeyOfChat)}
      ref={divRef}
    >
      <ProfileAvatar
        pubkey={pubkeyOfChat}
        description={lastMessage ? lastMessage.content : "No messages yet"}
        descriptionClassname="line-clamp-1 break-all overflow-hidden text-light-text w-full h-[15px]"
        baseClassname="justify-start w-4/5"
        wrapperClassname="w-4/5 h-full"
      />
      <div className="flex flex-shrink-0 flex-grow flex-col text-right text-light-text">
        <div className="h-1/2">
          {unreadCount > 0 ? (
            <span className="ml-2 rounded-full bg-dark-fg p-1 text-xs text-light-bg">
              {unreadCount}
            </span>
          ) : (
            <div className="h-[20px]">{/* spacer */}</div>
          )}
        </div>
        <div className="h-1/2">
          <span>
            {lastMessage
              ? timeSinceMessageDisplayText(lastMessage.created_at).short
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatButton;

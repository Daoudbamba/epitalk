import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDmStore } from "@/store/dm.store";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";

export function useNotificationClick() {
  const router = useRouter();

  useEffect(() => {
    const handleDmClick = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const { userId } = event.detail ?? {};
      if (userId) useDmStore.getState().setActivePeer(userId);
      router.push("/dm");
    };

    const handleServerMessageClick = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const { serverId, channelId, messageId } = event.detail ?? {};
      if (serverId) useServerStore.getState().setActiveServer(serverId);
      if (channelId) useChannelStore.getState().setActiveChannel(channelId);
      router.push("/servers");
      if (messageId) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("notification:scroll-to-message", { detail: { messageId } })
          );
        }, 600);
      }
    };

    window.addEventListener("notification:dm-click", handleDmClick);
    window.addEventListener("notification:server-message-click", handleServerMessageClick);

    return () => {
      window.removeEventListener("notification:dm-click", handleDmClick);
      window.removeEventListener("notification:server-message-click", handleServerMessageClick);
    };
  }, [router]);
}

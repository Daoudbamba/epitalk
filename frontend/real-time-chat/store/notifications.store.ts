import { create } from "zustand";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";

export type NotificationType = "dm" | "mention" | "channel_update" | "server_message" | "info" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  userId?: string;
  data?: Record<string, any>;
  serverId?: string;
  serverName?: string;
  channelId?: string;
  channelName?: string;
}

type NotificationState = {
  isEnabled: boolean;
  notifications: Notification[];
  
  // Actions
  setEnabled: (enabled: boolean) => void;
  showNotification: (config: {
    type: NotificationType;
    title: string;
    message: string;
    userId?: string;
    data?: Record<string, any>;
    isHistorical?: boolean;
  }) => void;
  clearNotifications: () => void;
  clearOldNotifications: (olderThanMs: number) => void;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  isEnabled: true,
  notifications: [],

  setEnabled: (enabled) => set({ isEnabled: enabled }),

  showNotification: (config) => {
    const { type, title, message, userId, data, isHistorical } = config;
    const currentUser = useAuthStore.getState().user;
    const isCurrentUser = userId && currentUser && userId === currentUser.id;
    
    // Don't show notification for own messages
    if (isCurrentUser) return;
    
    // Don't show notifications for historical messages (loaded from archive)
    if (isHistorical) return;
    
    // Check if notifications are enabled
    if (!get().isEnabled) return;

    // Check browser notification permission
    const shouldShowSystemNotification =
      typeof window !== "undefined" &&
      Notification.permission === "granted";

    // Show toast notification in-app
    const toastConfig = {
      title,
      description: message,
      action:
        type === "dm" || type === "server_message"
          ? {
              label: "Voir",
              onClick: () => {
                // Navigation will be handled by the app
                window.dispatchEvent(
                  new CustomEvent(
                    type === "dm" ? "notification:dm-click" : "notification:server-message-click",
                    {
                      detail: { userId, ...data },
                    }
                  )
                );
              },
            }
          : undefined,
    };

    // Determine toast type based on notification type
    if (type === "dm" || type === "mention" || type === "server_message") {
      toast.success(title, toastConfig);
    } else if (type === "error") {
      toast.error(title, toastConfig);
    } else {
      toast.info(title, toastConfig);
    }

    // Show system notification if available
    if (shouldShowSystemNotification && (type === "dm" || type === "server_message")) {
      try {
        const tag = type === "dm" ? `dm-${userId}` : `server-msg-${data?.channelId}`;
        new Notification(title, {
          body: message,
          icon: "/favicon.ico",
          tag,
          badge: "/favicon.ico",
        });
      } catch (error) {
        console.error("Failed to show system notification:", error);
      }
    }

    // Store notification in state
    const notification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      title,
      message,
      timestamp: new Date(),
      userId,
      data,
      serverId: data?.serverId,
      serverName: data?.serverName,
      channelId: data?.channelId,
      channelName: data?.channelName,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 100), // Keep last 100
    }));
  },

  clearNotifications: () => set({ notifications: [] }),

  clearOldNotifications: (olderThanMs) => {
    const cutoff = Date.now() - olderThanMs;
    set((state) => ({
      notifications: state.notifications.filter(
        (n) => n.timestamp.getTime() > cutoff
      ),
    }));
  },
}));

/**
 * Hook to request browser notification permission
 */
export function useRequestNotificationPermission() {
  const requestPermission = async () => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch (error) {
        console.error("Failed to request notification permission:", error);
        return false;
      }
    }

    return false;
  };

  return { requestPermission };
}

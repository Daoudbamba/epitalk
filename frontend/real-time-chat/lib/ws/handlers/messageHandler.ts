import { useMessageStore } from "@/store/message.store";
import { useNotificationStore } from "@/store/notifications.store";
import { useAuthStore } from "@/store/auth.store";
import { useChannelStore } from "@/store/channel.store";
import { useServerStore } from "@/store/server.store";
import type { z } from "zod";
import type {
  MessageNewSchema,
  MessageEditedSchema,
  MessageDeletedSchema,
  MessagePinnedSchema,
  MessageUnpinnedSchema,
  ReactionAddedSchema,
  ReactionRemovedSchema,
  MessageNotificationSchema,
} from "@/lib/ws/types";

type MessageNew = z.infer<typeof MessageNewSchema>;
type MessageEdited = z.infer<typeof MessageEditedSchema>;
type MessageDeleted = z.infer<typeof MessageDeletedSchema>;
type MessagePinned = z.infer<typeof MessagePinnedSchema>;
type MessageUnpinned = z.infer<typeof MessageUnpinnedSchema>;
type ReactionAdded = z.infer<typeof ReactionAddedSchema>;
type ReactionRemoved = z.infer<typeof ReactionRemovedSchema>;
type MessageNotification = z.infer<typeof MessageNotificationSchema>;

// Deduplication — prevents double notifications for the same message_id
const seenMessageIds = new Set<string>();

function formatNotifContent(content: string, attachmentUrl?: string | null): string {
  if (attachmentUrl) return "📎 Fichier";
  try {
    const parsed = JSON.parse(content) as { type?: string };
    if (parsed?.type === "gif") return "🖼 GIF";
  } catch {
    // not JSON
  }
  return content.length > 100 ? content.slice(0, 97) + "…" : content;
}

export const messageHandler = {
  onMessageNew(payload: MessageNew): void {
    useMessageStore.getState().addMessage(payload.channel_id, {
      id: payload.id,
      channel_id: payload.channel_id,
      author_id: payload.author_id,
      username: payload.username,
      content: payload.content,
      created_at: payload.created_at,
      reply_to: payload.reply_to ?? undefined,
      attachment_url: payload.attachment_url,
      reactions: payload.reactions,
    });

    const currentUser = useAuthStore.getState().user;

    // Skip own messages
    if (payload.author_id === currentUser?.id) return;

    // Deduplication
    if (seenMessageIds.has(payload.id)) return;
    seenMessageIds.add(payload.id);
    if (seenMessageIds.size > 500) {
      const first = seenMessageIds.values().next().value;
      if (first) seenMessageIds.delete(first);
    }

    // Historical messages (loaded from archive on JoinChannel) — skip
    const messageAgeMs = Date.now() - new Date(payload.created_at).getTime();
    if (messageAgeMs > 5000) return;

    // Skip if the user is currently looking at this channel and the window is focused
    const activeChannelId = useChannelStore.getState().activeChannelId;
    const windowFocused = typeof document !== "undefined" && document.hasFocus();
    if (payload.channel_id === activeChannelId && windowFocused) return;

    // Resolve channel and server — use allChannels for cross-server lookup
    const channelStore = useChannelStore.getState();
    const channel =
      channelStore.allChannels.find((c) => c.id === payload.channel_id) ??
      channelStore.channels.find((c) => c.id === payload.channel_id);
    const server = channel
      ? useServerStore.getState().servers.find((s) => s.id === channel.server_id)
      : null;

    const channelName = channel?.name ?? "channel";
    const serverName = server?.name ?? "Serveur";
    const username = payload.username ?? "Utilisateur";
    const body = formatNotifContent(payload.content, payload.attachment_url);

    useNotificationStore.getState().showNotification({
      type: "server_message",
      title: `#${channelName} — ${serverName}`,
      message: `${username}: ${body}`,
      data: {
        username,
        channelId: payload.channel_id,
        channelName,
        serverId: server?.id,
        serverName,
        messageId: payload.id,
      },
    });
  },

  onMessageEdited(payload: MessageEdited): void {
    useMessageStore
      .getState()
      .updateMessage(payload.channel_id, payload.id, {
        content: payload.content,
        edited_at: payload.edited_at,
      });
  },

  onMessageDeleted(payload: MessageDeleted): void {
    useMessageStore.getState().removeMessage(payload.channel_id, payload.id);
  },

  onMessagePinned(payload: MessagePinned): void {
    useMessageStore
      .getState()
      .updateMessage(payload.channel_id, payload.message_id, {
        pinned_by: payload.pinned_by,
        pinned_at: payload.pinned_at,
      });
  },

  onMessageUnpinned(payload: MessageUnpinned): void {
    useMessageStore
      .getState()
      .updateMessage(payload.channel_id, payload.message_id, {
        pinned_by: null,
        pinned_at: null,
      });
  },

  onReactionAdded(payload: ReactionAdded): void {
    const { messages } = useMessageStore.getState();
    for (const [channelId, msgs] of Object.entries(messages)) {
      const msg = msgs.find((m) => m.id === payload.message_id);
      if (!msg) continue;
      const existing = msg.reactions ?? [];
      const already = existing.some(
        (r) => r.user_id === payload.user_id && r.emoji === payload.emoji,
      );
      if (already) return;
      useMessageStore.getState().updateMessage(channelId, payload.message_id, {
        reactions: [
          ...existing,
          { emoji: payload.emoji, user_id: payload.user_id, username: payload.username },
        ],
      });
      return;
    }
  },

  onReactionRemoved(payload: ReactionRemoved): void {
    const { messages } = useMessageStore.getState();
    for (const [channelId, msgs] of Object.entries(messages)) {
      const msg = msgs.find((m) => m.id === payload.message_id);
      if (!msg) continue;
      useMessageStore.getState().updateMessage(channelId, payload.message_id, {
        reactions: (msg.reactions ?? []).filter(
          (r) => !(r.user_id === payload.user_id && r.emoji === payload.emoji),
        ),
      });
      return;
    }
  },

  onMessageNotification(payload: MessageNotification): void {
    const currentUser = useAuthStore.getState().user;

    // Skip own messages
    if (payload.author_id === currentUser?.id) return;

    // Deduplication
    if (seenMessageIds.has(payload.message_id)) return;
    seenMessageIds.add(payload.message_id);
    if (seenMessageIds.size > 500) {
      const first = seenMessageIds.values().next().value;
      if (first) seenMessageIds.delete(first);
    }

    // Historical messages (loaded from archive on JoinChannel) — skip
    const messageAgeMs = Date.now() - new Date(payload.created_at).getTime();
    if (messageAgeMs > 5000) return;

    // Skip if the user is currently viewing this exact channel in this server
    // Uses visibilityState (tab visible) rather than hasFocus() because hasFocus()
    // returns false in common situations where the user can still see the messages
    // (scrolling without input focus, DevTools open, etc.).
    const activeChannelId = useChannelStore.getState().activeChannelId;
    const activeServerId = useServerStore.getState().activeServerId;
    const hasFocus = typeof document !== "undefined" && document.hasFocus();
    const isPageVisible =
      typeof document !== "undefined" && document.visibilityState === "visible";
    const shouldSkip =
      payload.channel_id === activeChannelId &&
      payload.server_id === activeServerId &&
      (hasFocus || isPageVisible);

    console.log("[Notif check]", {
      payloadChannel: payload.channel_id,
      activeChannel: activeChannelId,
      payloadServer: payload.server_id,
      activeServer: activeServerId,
      hasFocus,
      isPageVisible,
      willSkip: shouldSkip,
    });

    if (shouldSkip) return;

    const body = formatNotifContent(payload.content, payload.attachment_url);

    useNotificationStore.getState().showNotification({
      type: "server_message",
      title: `#${payload.channel_name} — ${payload.server_name}`,
      message: `${payload.author_username}: ${body}`,
      data: {
        username: payload.author_username,
        channelId: payload.channel_id,
        channelName: payload.channel_name,
        serverId: payload.server_id,
        serverName: payload.server_name,
        messageId: payload.message_id,
      },
    });
  },
};

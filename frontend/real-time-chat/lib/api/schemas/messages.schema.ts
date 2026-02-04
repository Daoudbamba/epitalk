import { z } from "zod";

export const MessageSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export const MessageListSchema = z.array(MessageSchema);

export type Message = z.infer<typeof MessageSchema>;

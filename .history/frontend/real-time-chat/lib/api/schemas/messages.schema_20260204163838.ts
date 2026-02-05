import { z } from "zod";

// Message schema - matches planned MongoDB document structure
// Backend will use snake_case: channel_id, server_id, author_id, created_at
export const MessageSchema = z.object({
  id: z.string(), // MongoDB ObjectId as string
  channel_id: z.string(),
  server_id: z.string(),
  author_id: z.string(),
  username: z.string(), // Denormalized for display
  content: z.string(),
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});

export const MessageListSchema = z.array(MessageSchema);

export type Message = z.infer<typeof MessageSchema>;

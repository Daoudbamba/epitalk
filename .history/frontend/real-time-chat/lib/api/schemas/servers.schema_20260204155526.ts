import { z } from "zod";

// Server schema
export const ServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner_id: z.string(),
  created_at: z.string(),
  member_count: z.number().optional(),
});

export type Server = z.infer<typeof ServerSchema>;

// Channel schema
export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  channel_type: z.enum(["text", "voice"]),
  server_id: z.string(),
  created_at: z.string(),
});

export type Channel = z.infer<typeof ChannelSchema>;

// Member schema (membership with user info)
// Note: Backend returns user_id as the identifier (no separate 'id' field)
export const MemberSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  role: z.enum(["owner", "admin", "moderator", "member"]),
  joined_at: z.string(),
});

// Alias for convenience
export type MemberId = string;

export type Member = z.infer<typeof MemberSchema>;

// Invite schema
export const InviteSchema = z.object({
  code: z.string(),
  server_id: z.string(),
  created_by: z.string(),
  expires_at: z.string().nullable(),
  max_uses: z.number().nullable(),
  uses: z.number(),
});

export type Invite = z.infer<typeof InviteSchema>;

import { z } from "zod";

export const ChannelSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  type: z.enum(["text", "voice"]).default("text"),
});

export type Channel = {
  id: string;
  serverId: string;
  name: string;
};

export const ChannelListSchema = z.array(ChannelSchema);

export const CreateChannelInputSchema = z.object({
  serverId: z.string(),
  name: z.string().min(1, "Nom requis"),
  type: z.enum(["text", "voice"]).optional(),
});

export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

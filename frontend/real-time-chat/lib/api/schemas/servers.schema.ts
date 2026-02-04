// lib/api/schemas/servers.schema.ts
import { z } from "zod";

export const memberSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export const serverSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  members: z.array(memberSchema),
});

export type Member = z.infer<typeof memberSchema>;
export type Server = z.infer<typeof serverSchema>;

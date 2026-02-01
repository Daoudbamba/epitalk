import { z } from "zod";

export const ServerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const ServerListSchema = z.array(ServerSchema);

export type Server = z.infer<typeof ServerSchema>;

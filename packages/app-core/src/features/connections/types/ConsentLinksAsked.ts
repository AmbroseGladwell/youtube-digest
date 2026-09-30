import { z } from "zod";

export const ConsentLinksAsked = z.array(z.object({ requestId: z.string(), askedAt: z.number() }));
export type ConsentLinksAsked = z.infer<typeof ConsentLinksAsked>;

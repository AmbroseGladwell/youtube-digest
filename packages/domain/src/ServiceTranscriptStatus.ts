import { z } from "zod";

// Whether this server fetches transcripts itself, asked before the rung is offered so a
// reader is never shown a way to make an overview that cannot work
// (docs/architecture/server-side-transcripts.md).
export const ServiceTranscriptStatus = z.object({ available: z.boolean() });
export type ServiceTranscriptStatus = z.infer<typeof ServiceTranscriptStatus>;

import { z } from "zod";

// Asked first, so no reader is offered a way that cannot work (docs/architecture/server-side-transcripts.md).
export const ServiceTranscriptStatus = z.object({ available: z.boolean() });
export type ServiceTranscriptStatus = z.infer<typeof ServiceTranscriptStatus>;

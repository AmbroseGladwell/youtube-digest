import type { NoteKind } from "@overview/domain";
import type { GenerationClient } from "../generateOverview.js";

// Answers the kind check with the given kind and passes every other request to the client.
export const answeringKindCheck =
  (client: GenerationClient, kind: NoteKind = "default"): GenerationClient =>
  async (request) =>
    "noteKind" in request.schema.shape ? { noteKind: kind } : client(request);

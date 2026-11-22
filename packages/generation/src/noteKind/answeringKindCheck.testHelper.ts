import type { NoteKind } from "@overview/domain";
import type { GenerationClient } from "../requestGeneratedOutput.js";

export const answeringKindCheck =
  (client: GenerationClient, kind: NoteKind = "default"): GenerationClient =>
  async (request) =>
    "noteKind" in request.schema.shape ? { noteKind: kind } : client(request);

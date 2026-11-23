import type { Overview } from "./Overview.js";
import { isWrittenSource } from "./Source.js";

// docs/features/chats.md, "Articles and recipe pages".
export type ChatSourceKind = "video" | "episode" | "article" | "recipe";

export const chatSourceKind = ({ source, recipe }: Pick<Overview, "source" | "recipe">): ChatSourceKind => {
  if (source.kind === "podcast") {
    return "episode";
  }
  if (isWrittenSource(source)) {
    return recipe === null ? "article" : "recipe";
  }
  return "video";
};

export const answeredFromOverviewAlone = (kind: ChatSourceKind): kind is "article" | "recipe" => kind === "article" || kind === "recipe";

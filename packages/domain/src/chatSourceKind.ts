import type { Overview } from "./Overview.js";

// docs/features/chats.md, "Articles and recipe pages".
export type ChatSourceKind = "video" | "episode" | "article" | "recipe";

export const chatSourceKind = ({ source, recipe }: Pick<Overview, "source" | "recipe">): ChatSourceKind => {
  if (source.kind === "podcast") {
    return "episode";
  }
  if (source.kind === "web") {
    return recipe === null ? "article" : "recipe";
  }
  return "video";
};

export const answeredFromOverviewAlone = (kind: ChatSourceKind): kind is "article" | "recipe" => kind === "article" || kind === "recipe";

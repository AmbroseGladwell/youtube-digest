import type { Overview } from "./Overview.js";

// What a chat is about, in the words its answers and the app use: a recipe page and an article
// are answered from their overview alone, a video and an episode from their words as well
// (docs/features/chats.md, "Articles and recipe pages").
export type ChatSourceKind = "video" | "episode" | "article" | "recipe";

export const chatSourceKind = ({ source, recipe }: Pick<Overview, "source" | "recipe">): ChatSourceKind =>
  source.kind === "podcast" ? "episode" : source.kind === "web" ? (recipe === null ? "article" : "recipe") : "video";

export const answeredFromOverviewAlone = (kind: ChatSourceKind): kind is "article" | "recipe" => kind === "article" || kind === "recipe";

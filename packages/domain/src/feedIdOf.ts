import { FeedId } from "./Brands.js";

export const feedIdOf = async (feedUrl: string): Promise<FeedId> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(feedUrl));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return FeedId.parse(hex);
};

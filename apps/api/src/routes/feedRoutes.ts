import type { FastifyInstance } from "fastify";
import { FeedCheckBody, FeedLookupBody, type FeedCheck, type FeedChecked, type FeedRead } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { FeedReader } from "../feeds/createFeedReader.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";

const CHECKED_AT_ONCE = 4;

export interface FeedRoutesOptions {
  reader: FeedReader;
  clock: () => Date;
}

const inTurns = async <T, R>(items: T[], atOnce: number, run: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, worker));
  return results;
};

// Signed in only, and never the link or the feed in a log: docs/features/followed-feeds.md, "The routes".
export const feedRoutes = (app: FastifyInstance, { reader, clock }: FeedRoutesOptions): void => {
  const accountKey = (request: { session: { accountId: string } | null }) => request.session?.accountId ?? null;

  app.post(
    "/feeds/lookup",
    { preHandler: rateLimitHook(rateLimits.feedLookupPerAccount, accountKey, clock) },
    async (request): Promise<FeedRead> => {
      const { url } = parseOrThrow(FeedLookupBody, request.body, "The link");
      return reader.lookUp(url, request.log);
    },
  );

  app.post(
    "/feeds/check",
    { preHandler: rateLimitHook(rateLimits.feedCheckPerAccount, accountKey, clock) },
    async (request): Promise<FeedCheck> => {
      const { feedUrls } = parseOrThrow(FeedCheckBody, request.body, "The feeds");
      const feeds = await inTurns([...new Set(feedUrls)], CHECKED_AT_ONCE, async (feedUrl): Promise<FeedChecked> => ({
        feedUrl,
        read: await reader.read(feedUrl, request.log),
      }));
      return { feeds };
    },
  );
};

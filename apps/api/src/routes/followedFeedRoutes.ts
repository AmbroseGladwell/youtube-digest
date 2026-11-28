import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, FeedId, feedIdOf, FOLLOWED_FEEDS_PATH, MOST_FEEDS_FOLLOWED } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { ifMatchOf, sendWritten } from "../http/writeHeaders.js";
import { decideReplace } from "../records/decideReplace.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import type { WriteDecision } from "../records/WriteDecision.js";

const Params = z.object({ id: FeedId });
const FEED_ID = "The feed's id";

const idMatchesAddress = async (id: string, feedUrl: unknown): Promise<boolean> =>
  typeof feedUrl === "string" && (await feedIdOf(feedUrl)) === id;

// docs/features/followed-feeds.md, "Following".
export const followedFeedRoutes = (app: FastifyInstance, records: RecordsRepository): void => {
  app.post(FOLLOWED_FEEDS_PATH, async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The followed feed");
    const id = parseOrThrow(FeedId, body.id, FEED_ID);
    if (!(await idMatchesAddress(id, body.feedUrl))) {
      throw new ApiError("invalid_request", "The feed's id is not the hash of its address");
    }
    const ifMatch = ifMatchOf(request);
    const decide = (current: StoredRecord | null, _held: StoredRecord | null, _required: unknown, liveCount: number): WriteDecision => {
      const following = current !== null && !current.deleted;
      if (!following && liveCount >= MOST_FEEDS_FOLLOWED) {
        request.log.warn(apiLogLines.feeds.followLimitReached({ limit: MOST_FEEDS_FOLLOWED }));
        throw new ApiError("feed_limit_reached", "The account already follows as many feeds as it can", { limit: MOST_FEEDS_FOLLOWED });
      }
      return decideReplace("followedFeed", current, { body, schemaVersion, updatedAt, ifMatch }, request.client!);
    };
    const [written] = await records.write(request.session!.accountId, [{ kind: "followedFeed", id, countsLive: "followedFeed", decide }]);
    return sendWritten(reply, written!, ifMatch === null ? 201 : 200);
  });

  app.delete(`${FOLLOWED_FEEDS_PATH}/:id`, async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, FEED_ID);
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      { kind: "followedFeed", id, decide: (current) => decideTombstone("followedFeed", current, ifMatch, request.client!) },
    ]);
    if (written === null || written === undefined) {
      request.log.info(apiLogLines.sync.recordAlreadyDeleted({ kind: "followedFeed", id }));
      return reply.status(204).send();
    }
    return sendWritten(reply, written);
  });
};

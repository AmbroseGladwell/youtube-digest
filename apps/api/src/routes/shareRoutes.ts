import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ShareRequest, ShareToken, shareContentHash, shareSnapshot, shareUrl } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { ShareRow, SharesRepository } from "../shares/SharesRepository.js";

const SHARE_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

// Enough for anyone sending overviews to people, and short of this service becoming
// somewhere to host a library (docs/features/sharing.md).
export const MAX_LIVE_SHARES_PER_ACCOUNT = 50;

const Params = z.object({ token: ShareToken });

export function shareRoutes(app: FastifyInstance, shares: SharesRepository, appUrl: string): void {
  const describe = (share: ShareRow) => ({ ...share, url: shareUrl(appUrl, share.token) });

  app.post("/shares", { bodyLimit: SHARE_BODY_LIMIT_BYTES }, async (request, reply) => {
    const { overview, transcript, narration } = parseOrThrow(ShareRequest, request.body, "The share request");
    const accountId = request.session!.accountId;

    const existing = await shares.listLive(accountId);
    const replacing = existing.some((share) => share.overviewId === overview.id);
    if (!replacing && existing.length >= MAX_LIVE_SHARES_PER_ACCOUNT) {
      throw new ApiError("too_many_requests", "This account has as many shared links as it can have at once", {
        limit: MAX_LIVE_SHARES_PER_ACCOUNT,
      });
    }

    const snapshot = shareSnapshot({ overview, transcript, narration });
    const share = await shares.put({
      accountId,
      overviewId: overview.id,
      snapshot,
      contentHash: await shareContentHash(snapshot.note),
    });
    request.log.info({ replacing, hasTranscript: transcript !== null, hasNarration: narration !== null }, "shareCreated");
    return reply.status(replacing ? 200 : 201).send(describe(share));
  });

  app.get("/shares", async (request) => ({
    shares: (await shares.listLive(request.session!.accountId)).map(describe),
  }));

  app.delete("/shares/:token", async (request, reply) => {
    const { token } = parseOrThrow(Params, request.params, "The share token");
    if (!(await shares.revoke(request.session!.accountId, token))) {
      throw new ApiError("not_found", "This account has no live shared link with that token");
    }
    request.log.info("shareRevoked");
    return reply.status(204).send();
  });
}

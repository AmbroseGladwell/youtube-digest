import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, ShareToken, type Sample, type SharedOverview } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { SharesRepository } from "../shares/SharesRepository.js";

const Params = z.object({ token: ShareToken });

// Start's samples, in the order config lists them. Each is a live share, so it's replaced or
// stopped the way any share is, and one that isn't live is left out rather than offered
// broken. Reading one counts no visit: it's Start's, not a page someone was sent
// (docs/features/onboarding.md, "Try a sample").
export function sampleRoutes(app: FastifyInstance, shares: SharesRepository, tokens: readonly ShareToken[]): void {
  const live = async (token: ShareToken): Promise<SharedOverview | null> => {
    const share = await shares.peek(token);
    return share === null || share === "revoked" ? null : share.snapshot;
  };

  app.get("/samples", { config: { public: true } }, async (request) => {
    const samples: Sample[] = [];
    for (const token of tokens) {
      const snapshot = await live(token);
      if (snapshot === null) request.log.warn(apiLogLines.shares.sampleMissing());
      else samples.push({ token, note: snapshot.note });
    }
    return { samples };
  });

  app.get("/samples/:token", { config: { public: true } }, async (request) => {
    const { token } = parseOrThrow(Params, request.params, "The sample");
    const snapshot = tokens.includes(token) ? await live(token) : null;
    if (snapshot === null) throw new ApiError("not_found", "There's no sample with that token");
    return snapshot;
  });
}

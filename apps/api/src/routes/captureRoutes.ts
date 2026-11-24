import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  CAPTURE_CLAIMS_PATH,
  CAPTURES_PATH,
  CaptureClaimRequest,
  OverviewId,
  SourceKey,
  type CaptureClaim,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { ifMatchOf, sendWritten } from "../http/writeHeaders.js";
import { decideReplace } from "../records/decideReplace.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import type { WriteDecision } from "../records/WriteDecision.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import type { CaptureClaimsRepository } from "../usage/CaptureClaimsRepository.js";
import type { CaptureSavesRepository } from "../usage/CaptureSavesRepository.js";
import { saveQuotas } from "../usage/saveQuotas.js";
import { nextUsageMonth } from "../usage/usageMonth.js";

const Params = z.object({ id: OverviewId });
const ClaimParams = z.object({ sourceKey: SourceKey });
const CLAIM_LEASE_MS = 10 * 60 * 1000;
const CLAIMED_SOURCE = "The claimed source";
const THE_CLAIM = "The claim";
const CAPTURE_ID = "The capture's id";

export interface CaptureRoutesOptions {
  records: RecordsRepository;
  transcripts: TranscriptsRepository;
  saves: CaptureSavesRepository;
  claims: CaptureClaimsRepository;
  sql: SqlClient;
  clock: () => Date;
}

const isSaved = (record: StoredRecord | null): boolean =>
  record !== null && !record.deleted && (record.body as { stage?: unknown } | null)?.stage === "saved";

const overviewIn = (held: StoredRecord | null, overviewOfId: StoredRecord | null): StoredRecord | null => {
  if (overviewOfId !== null && !overviewOfId.deleted) {
    return overviewOfId;
  }
  return held?.kind === "overview" ? held : null;
};

const refuseHeld = (held: StoredRecord | null, overviewOfId: StoredRecord | null): void => {
  const overview = overviewIn(held, overviewOfId);
  if (overview !== null) {
    throw new ApiError("video_already_held", "The account already holds an overview of this source", { overviewId: overview.id });
  }
  if (held !== null) {
    throw new ApiError("capture_already_held", "The account already keeps this source", { captureId: held.id });
  }
};

// docs/features/kept-links.md, "The record" and "The save limit".
export const captureRoutes = (app: FastifyInstance, { records, transcripts, saves, claims, sql, clock }: CaptureRoutesOptions): void => {
  const reserveSave = async (accountId: AccountId, log: FastifyBaseLogger) => {
    const now = clock();
    const plan = await accountPlan(sql, accountId);
    const limit = saveQuotas[plan];
    const reservation = await saves.reserve(now, accountId, limit);
    if (!reservation.reserved) {
      log.warn(apiLogLines.captures.saveLimitReached({ plan, limit }));
      throw new ApiError("too_many_requests", "You've saved this month's sources without an overview", {
        quota: "saves",
        used: reservation.used,
        limit,
        resetsOn: nextUsageMonth(now),
      });
    }
    return { month: reservation.month, plan, limit };
  };

  app.post(CAPTURES_PATH, async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The capture");
    const id = parseOrThrow(OverviewId, body.id, CAPTURE_ID);
    const sourceKey = parseOrThrow(SourceKey, body.sourceKey, "The capture's source");
    const ifMatch = ifMatchOf(request);
    const accountId = request.session!.accountId;
    const counts = body.stage === "saved" && !isSaved(await records.read(accountId, "capture", id));
    const save = counts ? await reserveSave(accountId, request.log) : null;
    const decide = (current: StoredRecord | null, held: StoredRecord | null, [overviewOfId]: Array<StoredRecord | null>): WriteDecision => {
      refuseHeld(held, overviewOfId ?? null);
      return decideReplace("capture", current, { body, schemaVersion, updatedAt, ifMatch }, request.client!);
    };
    try {
      const [written] = await records.write(accountId, [
        { kind: "capture", id, sourceKey, heldBy: ["overview", "capture"], requires: [{ kind: "overview", id }], decide },
      ]);
      if (save !== null) {
        request.log.info(apiLogLines.captures.saved({ used: await saves.usedIn(clock(), accountId), limit: save.limit }));
      }
      return sendWritten(reply, written!, ifMatch === null ? 201 : 200);
    } catch (error) {
      if (save !== null) {
        await saves.release(save.month, accountId);
      }
      throw error;
    }
  });

  app.delete(`${CAPTURES_PATH}/:id`, async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, CAPTURE_ID);
    const ifMatch = ifMatchOf(request);
    const accountId = request.session!.accountId;
    const [written] = await records.write(accountId, [
      { kind: "capture", id, decide: (current) => decideTombstone("capture", current, ifMatch, request.client!) },
    ]);
    const forgotten = await transcripts.forgetUnnoted(accountId);
    if (forgotten > 0) {
      request.log.info(apiLogLines.transcripts.forgotten({ count: forgotten }));
    }
    if (written === null || written === undefined) {
      request.log.info(apiLogLines.sync.recordAlreadyDeleted({ kind: "capture", id }));
      return reply.status(204).send();
    }
    return sendWritten(reply, written);
  });

  app.post(`${CAPTURE_CLAIMS_PATH}/:sourceKey`, async (request): Promise<CaptureClaim> => {
    const { sourceKey } = parseOrThrow(ClaimParams, request.params, CLAIMED_SOURCE);
    const { holder } = parseOrThrow(CaptureClaimRequest, request.body, THE_CLAIM);
    const now = clock();
    const outcome = await claims.claim(request.session!.accountId, sourceKey, holder, now, new Date(now.getTime() + CLAIM_LEASE_MS));
    if (!outcome.claimed) {
      request.log.info(apiLogLines.captures.claimedElsewhere());
      throw new ApiError("claimed_elsewhere", "Another device is making this source", { until: outcome.until.toISOString() });
    }
    return { until: outcome.until.toISOString() };
  });

  app.delete(`${CAPTURE_CLAIMS_PATH}/:sourceKey`, async (request, reply) => {
    const { sourceKey } = parseOrThrow(ClaimParams, request.params, CLAIMED_SOURCE);
    const { holder } = parseOrThrow(CaptureClaimRequest, request.body, THE_CLAIM);
    await claims.release(request.session!.accountId, sourceKey, holder);
    return reply.status(204).send();
  });
};

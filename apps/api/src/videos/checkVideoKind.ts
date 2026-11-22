import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, type NoteKind, type StoredTranscript, type VideoId, type VideoSource } from "@overview/domain";
import { kindSampleOfVideo } from "@overview/generation";
import type { CostPayer } from "../costs/AccountCostsRepository.js";
import type { OurKeyGenerator } from "../generation/OurKeyGenerator.js";
import type { ServiceCaller, ServiceTranscripts } from "../transcripts/ServiceTranscripts.js";
import type { VideoKindsRepository } from "./VideoKindsRepository.js";

export interface CheckedVideoKind {
  noteKind: NoteKind | null;
  transcript: StoredTranscript | null;
}

const UNCHECKED: CheckedVideoKind = { noteKind: null, transcript: null };

export interface CheckVideoKindOptions {
  generator: OurKeyGenerator | null;
  service: ServiceTranscripts | null;
  kinds: VideoKindsRepository;
  now: Date;
  log: FastifyBaseLogger;
}

// Why it runs as the link is read: docs/features/onboarding.md, "Nothing paid before the account".
export const checkVideoKind = async (
  videoId: VideoId,
  video: VideoSource,
  caller: ServiceCaller,
  { generator, service, kinds, now, log }: CheckVideoKindOptions,
): Promise<CheckedVideoKind> => {
  const known = await kinds.kindOf(videoId);
  if (known !== null) {
    return { noteKind: known, transcript: null };
  }
  if (generator === null || service === null) {
    return UNCHECKED;
  }
  const signedOut = !("accountId" in caller);
  if (signedOut && !(await kinds.reserveSignedOutCheck(now))) {
    log.warn(apiLogLines.videos.signedOutKindChecksSpent());
    return UNCHECKED;
  }
  const transcript = await service
    .resolve(videoId, caller, log)
    .then((answer) => answer.transcript)
    .catch(() => null);
  if (transcript === null || transcript.segments.length === 0) {
    return UNCHECKED;
  }
  const payer: CostPayer = signedOut ? "signed-out" : { accountId: caller.accountId };
  const noteKind = await generator.kindCheck(payer, kindSampleOfVideo({ video, transcript: transcript.segments }), log).catch(() => null);
  if (noteKind !== null) {
    await kinds.remember(now, videoId, noteKind);
  }
  return { noteKind, transcript };
};

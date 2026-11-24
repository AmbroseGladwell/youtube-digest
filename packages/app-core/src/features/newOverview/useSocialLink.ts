import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  heldOverviewOf,
  OverviewId,
  parseSocialPostLink,
  POST_LEAST_WORDS,
  sourceKey,
  wordCount,
  type SocialPost,
  type SocialReadFailure,
  type TranscriptionOffer,
} from "@overview/domain";
import { NO_SPEECH_WORDS } from "@overview/generation";
import { createFetchSocialApi } from "@overview/sync";
import { useStores } from "../../stores/StoresContext.js";
import { countWords } from "../../util/countWords.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import type { SocialWords } from "./api/generationPipeline.js";
import { generationKeys } from "./generationKeys.js";
import { isTranscribable } from "./useTikTokLink.js";

// Counted in code before anything is spent: a video with no words to find, or too few; a post with too short a description.
export type SocialStop = "no-words" | "no-speech" | "too-few-words";

export type SocialLink =
  | { status: "none" }
  | { status: "reading" }
  | { status: "found"; post: SocialPost; words: SocialWords | null; transcription: TranscriptionOffer | null; stop: SocialStop | null }
  | { status: "held"; post: SocialPost; overviewId: OverviewId; savedAt: string | null }
  | { status: "failed"; reason: SocialReadFailure }
  | { status: "unreachable" };

const SETTLED_MS = 350;
const KEPT_MS = 5 * 60 * 1000;

export const isSocialLink = (link: string): boolean => parseSocialPostLink(link) !== null;

const stopOf = (post: SocialPost, words: SocialWords | null, transcription: TranscriptionOffer | null): SocialStop | null => {
  if (post.media !== "video") {
    return wordCount(post.description) < POST_LEAST_WORDS ? "too-few-words" : null;
  }
  if (words === null) {
    return isTranscribable(transcription) ? null : "no-words";
  }
  const said = words.transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0);
  return said < NO_SPEECH_WORDS ? "no-speech" : null;
};

// Read through our server as soon as it settles: docs/features/social-posts.md, "Pasting a link".
export const useSocialLink = (url: string) => {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { overviewStore } = useStores();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;

  const link = url.trim();
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(link), SETTLED_MS);
    return () => clearTimeout(timer);
  }, [link]);

  const parsed = parseSocialPostLink(link);
  const offered = available && parsed !== null;
  const readable = offered && parsed.kind !== "not-a-post";
  const query = useQuery({
    queryKey: [...generationKeys.all, "socialLink", settled],
    enabled: readable && settled === link,
    retry: false,
    staleTime: KEPT_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<SocialLink> => {
      const read = await createFetchSocialApi({ baseUrl: apiUrl!, token: connection.token }).read(link);
      if (read.status === "failed") {
        return { status: "failed", reason: read.reason };
      }
      const { post } = read;
      const words: SocialWords | null = read.transcript === null ? null : { transcript: read.transcript, source: "social-vendor" };
      const transcription = read.transcription ?? null;
      const held = await heldOverviewOf(overviewStore, sourceKey({ kind: post.platform, id: post.id })!);
      if (held === null) {
        return { status: "found", post, words, transcription, stop: stopOf(post, words, transcription) };
      }
      const overviews = await overviewStore.listOverviews();
      return {
        status: "held",
        post,
        overviewId: OverviewId.parse(held.id),
        savedAt: overviews.find(({ id }) => id === held.id)?.savedAt ?? null,
      };
    },
  });

  const socialLink: SocialLink = useMemo(() => {
    if (!offered) {
      return { status: "none" };
    }
    if (parsed.kind === "not-a-post") {
      return { status: "failed", reason: "not-a-post" };
    }
    if (settled !== link || query.isFetching) {
      return { status: "reading" };
    }
    if (query.isError) {
      return { status: "unreachable" };
    }
    return query.data ?? { status: "reading" };
  }, [offered, parsed, link, settled, query.isFetching, query.isError, query.data]);

  return { available, platform: parsed?.platform ?? null, link: socialLink, retry: () => void query.refetch() };
};

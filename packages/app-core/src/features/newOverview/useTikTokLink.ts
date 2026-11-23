import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { heldOverviewOf, OverviewId, parseTikTokLink, sourceKey, type TikTokReadFailure, type TikTokVideo } from "@overview/domain";
import { NO_SPEECH_WORDS } from "@overview/generation";
import { createFetchTikTokApi } from "@overview/sync";
import { useTikTokPages } from "../../app/TikTokPagesContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { countWords } from "../../util/countWords.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { readTikTokLink } from "../tiktok/api/readTikTokLink.js";
import type { TikTokWords } from "./api/generationPipeline.js";
import { generationKeys } from "./generationKeys.js";

// Both counted in code before anything is spent (designs 130e, 130f); music is the kind check's, after Create.
export type TikTokStop = "no-captions" | "no-speech";

export type TikTokLinkFailure = TikTokReadFailure | "profile" | "photo";

export type TikTokLink =
  | { status: "none" }
  | { status: "reading" }
  | { status: "found"; video: TikTokVideo; words: TikTokWords | null; stop: TikTokStop | null }
  | { status: "held"; video: TikTokVideo; overviewId: OverviewId; savedAt: string | null }
  | { status: "failed"; reason: TikTokLinkFailure }
  | { status: "unreachable" };

const SETTLED_MS = 350;
const KEPT_MS = 5 * 60 * 1000;

export const isTikTokLink = (link: string): boolean => parseTikTokLink(link) !== null;

// A photo post's address says so; any other TikTok address that isn't a video is a profile, a sound or a tag (130m, 130m-2).
const notAVideo = (link: string): TikTokLinkFailure => (/\/photo\//.test(link) ? "photo" : "profile");

const stopOf = (words: TikTokWords | null): TikTokStop | null => {
  if (words === null) {
    return "no-captions";
  }
  const said = words.transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0);
  return said < NO_SPEECH_WORDS ? "no-speech" : null;
};

// Read as soon as it settles, the reader's own browser first: docs/features/tiktok-links.md, "Pasting a link".
export const useTikTokLink = (url: string) => {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { overviewStore } = useStores();
  const own = useTikTokPages();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;

  const link = url.trim();
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(link), SETTLED_MS);
    return () => clearTimeout(timer);
  }, [link]);

  const parsed = parseTikTokLink(link);
  const offered = available && parsed !== null;
  const readable = offered && parsed.kind !== "not-a-video";
  const query = useQuery({
    queryKey: [...generationKeys.all, "tiktokLink", settled],
    enabled: readable && settled === link,
    retry: false,
    staleTime: KEPT_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TikTokLink> => {
      const read = await readTikTokLink(link, { own, server: createFetchTikTokApi({ baseUrl: apiUrl!, token: connection.token }).read });
      if (read.status === "failed") {
        return { status: "failed", reason: read.reason === "not-a-video" ? "photo" : read.reason };
      }
      const held = await heldOverviewOf(overviewStore, sourceKey({ kind: "tiktok", id: read.video.id })!);
      if (held === null) {
        return { status: "found", video: read.video, words: read.words, stop: stopOf(read.words) };
      }
      const overviews = await overviewStore.listOverviews();
      return {
        status: "held",
        video: read.video,
        overviewId: OverviewId.parse(held.id),
        savedAt: overviews.find(({ id }) => id === held.id)?.savedAt ?? null,
      };
    },
  });

  const tiktokLink: TikTokLink = useMemo(() => {
    if (!offered) {
      return { status: "none" };
    }
    if (parsed.kind === "not-a-video") {
      return { status: "failed", reason: notAVideo(link) };
    }
    if (settled !== link || query.isFetching) {
      return { status: "reading" };
    }
    if (query.isError) {
      return { status: "unreachable" };
    }
    return query.data ?? { status: "reading" };
  }, [offered, parsed, link, settled, query.isFetching, query.isError, query.data]);

  return { available, link: tiktokLink, retry: () => void query.refetch() };
};

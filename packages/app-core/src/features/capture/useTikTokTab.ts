import { useCallback, useEffect, useState } from "react";
import { heldOverviewOf, OverviewId, parseTikTokLink, sourceKey, type TikTokVideo } from "@overview/domain";
import { createFetchTikTokApi } from "@overview/sync";
import { useActivePage } from "../../app/ArticlePagesContext.js";
import { useTikTokPages } from "../../app/TikTokPagesContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { readTikTokLink, type TikTokLinkRead } from "../tiktok/api/readTikTokLink.js";
import type { TikTokWords } from "../newOverview/api/generationPipeline.js";
import type { ArticleFailureCopy } from "../newOverview/util/articleFailureCopy.js";
import { tiktokLinkFailureCopy, tiktokStopCopy } from "../newOverview/util/tiktokLinkFailureCopy.js";
import { countWords } from "../../util/countWords.js";
import { NO_SPEECH_WORDS } from "@overview/generation";

export type TikTokTabState =
  // Read in the reader's own browser only once TikTok's access is granted, so a tab looked at costs nothing.
  | { status: "offered"; video: TikTokVideo | null }
  | { status: "reading"; video: TikTokVideo | null }
  | { status: "held"; overviewId: OverviewId }
  | { status: "stopped"; video: TikTokVideo | null; copy: ArticleFailureCopy };

export interface TikTokTab {
  url: string;
  // The tab's own title, for the card before the video has been read.
  title: string;
  state: TikTokTabState;
  // Called inside the click: Chrome asks for TikTok there, and the vendor is asked only if the browser can't read it.
  make: (start: (video: TikTokVideo, words: TikTokWords) => void) => void;
}

const TAB_TITLE_SUFFIX = /\s*\|\s*TikTok\s*$/;

// Design 130i-2: the browser's read and the vendor both failed, so it can't be read right now.
const BOTH_FAILED: ArticleFailureCopy = {
  title: "This TikTok can’t be read right now",
  body: "TikTok didn’t answer, and neither did our other way of reading it. Try again in a minute. Nothing was used.",
  way: "tryAgain",
  wayLabel: "Try again",
};

const stoppedCopy = (read: TikTokLinkRead): ArticleFailureCopy | null => {
  if (read.status === "failed") {
    return read.reason === "unavailable" || read.reason === "not-a-video"
      ? { ...tiktokLinkFailureCopy(read.reason === "not-a-video" ? "photo" : read.reason), way: null, wayLabel: null }
      : BOTH_FAILED;
  }
  if (read.words === null) {
    return { ...tiktokStopCopy("no-captions"), way: null, wayLabel: null };
  }
  const said = read.words.transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0);
  return said < NO_SPEECH_WORDS ? { ...tiktokStopCopy("no-speech"), way: null, wayLabel: null } : null;
};

// Design 130i: "On this tab" for a TikTok video's tab in the panel.
export const useTikTokTab = (): TikTokTab | null => {
  const activePage = useActivePage();
  const own = useTikTokPages();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { overviewStore } = useStores();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;
  const parsed = activePage === null ? null : parseTikTokLink(activePage.url);
  const url = parsed?.kind === "video" && activePage !== null ? activePage.url : null;
  const videoId = parsed?.kind === "video" ? parsed.videoId : null;
  const [state, setState] = useState<{ url: string; state: TikTokTabState } | null>(null);

  useEffect(() => {
    if (url === null || videoId === null || !available) {
      return;
    }
    let current = true;
    const settle = (next: TikTokTabState) => current && setState({ url, state: next });
    settle({ status: "offered", video: null });
    void (async () => {
      const held = await heldOverviewOf(overviewStore, sourceKey({ kind: "tiktok", id: videoId })!);
      if (held !== null) {
        settle({ status: "held", overviewId: OverviewId.parse(held.id) });
        return;
      }
      if (own !== null && (await own.hasAccess())) {
        const read = await own.read(url).catch(() => null);
        if (read?.status === "read") {
          settle({ status: "offered", video: read.video });
        }
      }
    })();
    return () => {
      current = false;
    };
  }, [url, videoId, available, own, overviewStore]);

  const known = state?.url === url ? state.state : null;
  const make = useCallback(
    (start: (video: TikTokVideo, words: TikTokWords) => void) => {
      if (url === null || apiUrl === null) {
        return;
      }
      const video = known !== null && "video" in known ? known.video : null;
      setState({ url, state: { status: "reading", video } });
      const asked = own === null ? Promise.resolve(false) : own.requestAccess().catch(() => false);
      void asked
        .then(() => readTikTokLink(url, { own, server: createFetchTikTokApi({ baseUrl: apiUrl, token: connection.token }).read }))
        .then((read) => {
          const copy = stoppedCopy(read);
          if (copy !== null || read.status !== "read") {
            setState({ url, state: { status: "stopped", video: read.status === "read" ? read.video : video, copy: copy ?? BOTH_FAILED } });
            return;
          }
          setState({ url, state: { status: "offered", video: read.video } });
          start(read.video, read.words!);
        })
        .catch(() => setState({ url, state: { status: "stopped", video, copy: BOTH_FAILED } }));
    },
    [url, apiUrl, own, connection.token, known],
  );

  if (url === null || activePage === null || !available) {
    return null;
  }
  return {
    url,
    title: activePage.title.replace(TAB_TITLE_SUFFIX, "").trim(),
    state: known ?? { status: "offered", video: null },
    make,
  };
};

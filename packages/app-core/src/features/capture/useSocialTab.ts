import { useCallback, useEffect, useState } from "react";
import {
  heldOverviewOf,
  OverviewId,
  parseSocialPostLink,
  POST_LEAST_WORDS,
  sourceKey,
  wordCount,
  type SocialPlatform,
  type SocialPost,
  type SocialRead,
  type TranscribeChoice,
  type TranscriptionOffer,
} from "@overview/domain";
import { NO_SPEECH_WORDS } from "@overview/generation";
import { createFetchSocialApi } from "@overview/sync";
import { useActivePage } from "../../app/ArticlePagesContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { countWords } from "../../util/countWords.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import type { SocialWords } from "../newOverview/api/generationPipeline.js";
import type { ArticleFailureCopy } from "../newOverview/util/articleFailureCopy.js";
import { socialLinkFailureCopy, socialStopCopy } from "../newOverview/util/socialLinkFailureCopy.js";
import { isTranscribable } from "../newOverview/useTikTokLink.js";

// Nothing is read until the press: a read costs a credit, and the page itself is never read (docs/features/social-posts.md).
export type SocialTabState =
  | { status: "offered"; post: SocialPost | null }
  | { status: "reading"; post: SocialPost | null }
  | { status: "held"; overviewId: OverviewId }
  | { status: "stopped"; post: SocialPost | null; copy: ArticleFailureCopy }
  | { status: "transcribable"; post: SocialPost; transcription: TranscriptionOffer };

export type StartSocial = (post: SocialPost, words: SocialWords | null, transcribe?: TranscribeChoice) => void;

export interface SocialTab {
  url: string;
  platform: SocialPlatform;
  // The tab's own title, for the card before the post has been read.
  title: string;
  state: SocialTabState;
  make: (start: StartSocial) => void;
}

const TAB_TITLE_SUFFIX = /\s*[|•·-]\s*(Instagram|Facebook)\s*$/;

const quiet = (copy: ArticleFailureCopy): ArticleFailureCopy => ({ ...copy, way: null, wayLabel: null });

const wordsOf = (read: Extract<SocialRead, { status: "read" }>): SocialWords | null =>
  read.transcript === null ? null : { transcript: read.transcript, source: "social-vendor" };

const stoppedCopy = (read: SocialRead): ArticleFailureCopy | null => {
  if (read.status === "failed") {
    const copy = socialLinkFailureCopy(read.reason, null);
    return read.reason === "blocked" || read.reason === "no-answer" ? copy : quiet(copy);
  }
  const { post } = read;
  if (post.media !== "video") {
    return wordCount(post.description) < POST_LEAST_WORDS ? quiet(socialStopCopy("too-few-words")) : null;
  }
  const words = wordsOf(read);
  if (words === null) {
    return isTranscribable(read.transcription ?? null) ? null : quiet(socialStopCopy("no-words"));
  }
  const said = words.transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0);
  return said < NO_SPEECH_WORDS ? quiet(socialStopCopy("no-speech")) : null;
};

// "On this tab" for an Instagram or Facebook post's tab in the panel, as TikTok's (130i), read only through our server.
export const useSocialTab = (): SocialTab | null => {
  const activePage = useActivePage();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { overviewStore } = useStores();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;
  const parsed = activePage === null ? null : parseSocialPostLink(activePage.url);
  const url = parsed !== null && parsed.kind !== "not-a-post" && activePage !== null ? activePage.url : null;
  const known = parsed?.kind === "post" ? sourceKey({ kind: parsed.platform, id: parsed.id }) : null;
  const [state, setState] = useState<{ url: string; state: SocialTabState } | null>(null);

  useEffect(() => {
    if (url === null || known === null || !available) {
      return;
    }
    let current = true;
    void heldOverviewOf(overviewStore, known).then((held) => {
      if (current && held !== null) {
        setState({ url, state: { status: "held", overviewId: OverviewId.parse(held.id) } });
      }
    });
    return () => {
      current = false;
    };
  }, [url, known, available, overviewStore]);

  const shown = state?.url === url ? state.state : null;
  const make = useCallback(
    (start: StartSocial) => {
      if (url === null || apiUrl === null) {
        return;
      }
      const post = shown !== null && "post" in shown ? shown.post : null;
      setState({ url, state: { status: "reading", post } });
      void createFetchSocialApi({ baseUrl: apiUrl, token: connection.token })
        .read(url)
        .then(async (read) => {
          const copy = stoppedCopy(read);
          if (read.status !== "read" || copy !== null) {
            setState({ url, state: { status: "stopped", post: read.status === "read" ? read.post : post, copy: copy! } });
            return;
          }
          const held = await heldOverviewOf(overviewStore, sourceKey({ kind: read.post.platform, id: read.post.id })!);
          if (held !== null) {
            setState({ url, state: { status: "held", overviewId: OverviewId.parse(held.id) } });
            return;
          }
          const words = wordsOf(read);
          if (read.post.media === "video" && words === null) {
            setState({ url, state: { status: "transcribable", post: read.post, transcription: read.transcription! } });
            return;
          }
          setState({ url, state: { status: "offered", post: read.post } });
          start(read.post, words);
        })
        .catch(() =>
          setState({ url, state: { status: "stopped", post, copy: socialLinkFailureCopy("unreachable", parsed?.platform ?? null) } }),
        );
    },
    [url, apiUrl, connection.token, shown, overviewStore, parsed?.platform],
  );

  if (url === null || parsed === null || activePage === null || !available) {
    return null;
  }
  return {
    url,
    platform: parsed.platform,
    title: activePage.title.replace(TAB_TITLE_SUFFIX, "").trim(),
    state: shown ?? { status: "offered", post: null },
    make,
  };
};

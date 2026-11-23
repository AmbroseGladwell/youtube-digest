import { SOCIAL_PLATFORM_NAME, type TranscribeChoice } from "@overview/domain";
import { EpisodeWordsNote } from "../../../newOverview/components/PodcastLinkStatus/PodcastLinkStatus.js";
import { SocialCard } from "../../../newOverview/components/SocialLinkStatus/SocialLinkStatus.js";
import { episodeActionOf, transcribeChoiceOf } from "../../../podcasts/util/episodeActionOf.js";
import { transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { ArticleFailureNotice } from "../ArticleFailureNotice/ArticleFailureNotice.js";
import type { SocialTab } from "../../useSocialTab.js";
import styles from "./SocialOffer.module.scss";
import { socialOfferTestIds } from "./SocialOfferTestIds.js";

export interface SocialOfferProps {
  tab: SocialTab;
  ready: boolean;
  onMake: () => void;
  onTranscribe: (choice: TranscribeChoice) => void;
  onFollowed?: (() => void) | undefined;
}

interface TranscribeOfferProps {
  state: Extract<SocialTab["state"], { status: "transcribable" }>;
  ready: boolean;
  onTranscribe: (choice: TranscribeChoice) => void;
  onFollowed: (() => void) | undefined;
}

// After the press found no words: asked as a TikTok's is, before anything is spent (305c).
const TranscribeOffer = ({ state, ready, onTranscribe, onFollowed }: TranscribeOfferProps) => {
  const words = { state: "none" as const, transcription: state.transcription };
  const choice = transcribeChoiceOf(episodeActionOf(words));
  return (
    <>
      {state.transcription.status === "needed" && (
        <p className={styles.needs} data-testid={socialOfferTestIds.needs}>
          No captions · {transcriptionCopy.needs(state.post.durationSeconds)}
        </p>
      )}
      <EpisodeWordsNote words={words} episodeSeconds={state.post.durationSeconds} onFollowed={onFollowed} source={state.post.platform} />
      {choice !== undefined && (
        <button
          type="button"
          className={styles.make}
          onClick={() => onTranscribe(choice)}
          disabled={!ready}
          data-testid={socialOfferTestIds.transcribeButton}
        >
          Transcribe and create
        </button>
      )}
    </>
  );
};

// As TikTok's (130i): "On this tab", the post, and the one way on.
export const SocialOffer = ({ tab, ready, onMake, onTranscribe, onFollowed }: SocialOfferProps) => {
  const { state } = tab;
  const post = "post" in state ? state.post : null;
  const name = SOCIAL_PLATFORM_NAME[tab.platform];
  return (
    <section className={styles.root} aria-label="On this tab" data-testid={socialOfferTestIds.card}>
      <p className={styles.label}>On this tab</p>
      {post === null ? (
        <div className={styles.light}>
          <span className={styles.lightCover} aria-hidden="true" />
          <span className={styles.lightWords}>
            <span className={styles.kicker}>{name}</span>
            <span className={styles.lightTitle} data-testid={socialOfferTestIds.tabTitle}>
              {tab.title === "" ? `${tab.platform === "instagram" ? "An" : "A"} ${name} post` : tab.title}
            </span>
          </span>
        </div>
      ) : (
        <SocialCard post={post} tinted />
      )}
      {state.status === "transcribable" && (
        <TranscribeOffer state={state} ready={ready} onTranscribe={onTranscribe} onFollowed={onFollowed} />
      )}
      {state.status === "stopped" && <ArticleFailureNotice copy={state.copy} onWay={onMake} />}
      {(state.status === "offered" || state.status === "reading") && (
        <button
          type="button"
          className={styles.make}
          onClick={onMake}
          disabled={!ready || state.status === "reading"}
          data-testid={socialOfferTestIds.makeButton}
        >
          {state.status === "reading" ? "Reading the post…" : "Make an overview of this post"}
        </button>
      )}
    </section>
  );
};

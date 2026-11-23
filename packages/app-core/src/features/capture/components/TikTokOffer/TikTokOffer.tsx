import type { TranscribeChoice } from "@overview/domain";
import { EpisodeWordsNote } from "../../../newOverview/components/PodcastLinkStatus/PodcastLinkStatus.js";
import { TikTokCard } from "../../../newOverview/components/TikTokLinkStatus/TikTokLinkStatus.js";
import { episodeActionOf, transcribeChoiceOf } from "../../../podcasts/util/episodeActionOf.js";
import { transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { ArticleFailureNotice } from "../ArticleFailureNotice/ArticleFailureNotice.js";
import type { TikTokTab } from "../../useTikTokTab.js";
import styles from "./TikTokOffer.module.scss";
import { tiktokOfferTestIds } from "./TikTokOfferTestIds.js";

export interface TikTokOfferProps {
  tab: TikTokTab;
  ready: boolean;
  onMake: () => void;
  onTranscribe: (choice: TranscribeChoice) => void;
  onFollowed?: (() => void) | undefined;
}

interface TranscribeOfferProps {
  state: Extract<TikTokTab["state"], { status: "transcribable" }>;
  ready: boolean;
  onTranscribe: (choice: TranscribeChoice) => void;
  onFollowed: (() => void) | undefined;
}

// After the press found no captions: asked as an episode is, before anything is spent (305c).
const TranscribeOffer = ({ state, ready, onTranscribe, onFollowed }: TranscribeOfferProps) => {
  const words = { state: "none" as const, transcription: state.transcription };
  const choice = transcribeChoiceOf(episodeActionOf(words));
  return (
    <>
      {state.transcription.status === "needed" && (
        <p className={styles.needs} data-testid={tiktokOfferTestIds.needs}>
          No captions · {transcriptionCopy.needs(state.video.durationSeconds)}
        </p>
      )}
      <EpisodeWordsNote words={words} episodeSeconds={state.video.durationSeconds} onFollowed={onFollowed} source="tiktok" />
      {choice !== undefined && (
        <button
          type="button"
          className={styles.make}
          onClick={() => onTranscribe(choice)}
          disabled={!ready}
          data-testid={tiktokOfferTestIds.transcribeButton}
        >
          Transcribe and create
        </button>
      )}
    </>
  );
};

// Designs 130i, 130i-2: "On this tab", the TikTok, and the one way on.
export const TikTokOffer = ({ tab, ready, onMake, onTranscribe, onFollowed }: TikTokOfferProps) => {
  const { state } = tab;
  const video = "video" in state ? state.video : null;
  return (
    <section className={styles.root} aria-label="On this tab" data-testid={tiktokOfferTestIds.card}>
      <p className={styles.label}>On this tab</p>
      {video === null ? (
        <div className={styles.light}>
          <span className={styles.lightCover} aria-hidden="true" />
          <span className={styles.lightWords}>
            <span className={styles.kicker}>TikTok</span>
            <span className={styles.lightTitle} data-testid={tiktokOfferTestIds.tabTitle}>
              {tab.title === "" ? "A TikTok video" : tab.title}
            </span>
          </span>
        </div>
      ) : (
        <TikTokCard video={video} tinted />
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
          data-testid={tiktokOfferTestIds.makeButton}
        >
          {state.status === "reading" ? "Reading the TikTok…" : "Make an overview of this TikTok"}
        </button>
      )}
    </section>
  );
};

import { modelLabel, PROVIDER_SHORT_LABEL } from "@overview/domain";
import type { NoSpeechReason } from "@overview/generation";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import type { RunError } from "../../types/RunError.js";
import { useReaderPlace } from "../../useReaderPlace.js";
import { pastedLinkFailureCopy } from "../../util/pastedLinkFailureCopy.js";
import { TranscriptionNotice } from "../../../podcasts/components/TranscriptionNotice/TranscriptionNotice.js";
import { transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import styles from "./RunErrorMessage.module.scss";
import type { RunErrorMessageTestIds } from "./RunErrorMessageTestIds.js";

export interface RunErrorMessageProps {
  error: RunError;
  className: string | undefined;
  testId: string;
  testIds: RunErrorMessageTestIds;
  onFollowed?: () => void;
  episodeSeconds?: number | null;
  onTranscribe?: () => void;
  onNotNow?: () => void;
}

export const RunErrorMessage = ({
  error,
  className,
  testId,
  testIds,
  onFollowed,
  episodeSeconds = null,
  onTranscribe,
  onNotNow,
}: RunErrorMessageProps) => {
  if (error.kind === "articleFetch") {
    return <ArticleFetchFailure error={error} />;
  }
  if (error.kind === "podcastNoTranscript") {
    return <PodcastNoTranscript testId={testId} />;
  }
  if (error.kind === "noSpeech") {
    return <NoSpeech reason={error.reason} testId={testId} />;
  }
  if (error.kind === "podcastNeedsTranscribing" || error.kind === "transcriptionFailed" || error.kind === "transcriptionRefused") {
    return (
      <TranscriptionStop
        error={error}
        episodeSeconds={episodeSeconds}
        onTranscribe={onTranscribe}
        onNotNow={onNotNow}
        onFollowed={onFollowed}
      />
    );
  }
  if (error.kind === "message") {
    return (
      <p className={className} data-testid={testId}>
        {error.message}
      </p>
    );
  }
  return (
    <p className={className} data-testid={testId}>
      {PROVIDER_SHORT_LABEL[error.provider]} couldn’t make this overview with {modelLabel(error.provider, error.model)}.{" "}
      <PageLink to={Routes.settingsSection("keys")} className={styles.settingsLink} data-testid={testIds.settingsLink} onClick={onFollowed}>
        Pick another model in Settings
      </PageLink>{" "}
      and try again.
    </p>
  );
};

// The read was the run's, so there is no field to try again from: only a way out of the app.
const ArticleFetchFailure = ({ error }: { error: Extract<RunError, { kind: "articleFetch" }> }) => {
  const place = useReaderPlace();
  const copy = pastedLinkFailureCopy(error.failure, error.url, place);
  const after = copy.after !== null && error.regenerating ? "Then press Regenerate in the side panel." : copy.after;
  return (
    <ArticleFailureNotice
      copy={copy.href === null ? { ...copy, way: null, wayLabel: null } : copy}
      href={copy.href}
      after={after}
      onWay={() => undefined}
    />
  );
};

interface TranscriptionStopProps {
  error: Extract<RunError, { kind: "podcastNeedsTranscribing" | "transcriptionFailed" | "transcriptionRefused" }>;
  episodeSeconds: number | null;
  onTranscribe: (() => void) | undefined;
  onNotNow: (() => void) | undefined;
  onFollowed: (() => void) | undefined;
}

const TranscriptionStop = ({ error, episodeSeconds, onTranscribe, onNotNow, onFollowed }: TranscriptionStopProps) => {
  const usage = useOverviewUsageQuery().data ?? null;
  const transcribing = usage?.transcription ?? null;
  const notNow = onNotNow === undefined ? null : { label: "Not now", onPress: onNotNow };
  if (error.kind === "podcastNeedsTranscribing") {
    return (
      <TranscriptionNotice
        notice={transcriptionCopy.ask(episodeSeconds)}
        primary={onTranscribe === undefined ? null : { label: "Transcribe and create", onPress: onTranscribe }}
        secondary={notNow}
        foot={transcriptionCopy.uses(episodeSeconds, transcribing)}
        takeFocus
      />
    );
  }
  if (error.kind === "transcriptionFailed") {
    const failed = transcriptionCopy.failed(error.reason);
    const differentLink = onNotNow === undefined ? null : { label: "Use a different link", onPress: onNotNow };
    return (
      <TranscriptionNotice
        notice={failed}
        primary={failed.retry && onTranscribe !== undefined ? { label: "Try again", onPress: onTranscribe } : null}
        secondary={failed.retry ? notNow : differentLink}
        takeFocus
      />
    );
  }
  const offer =
    error.refusal === "too-long"
      ? { status: "too-long" as const, episodeSeconds: error.episodeSeconds ?? episodeSeconds ?? 0 }
      : {
          status: "not-enough" as const,
          episodeSeconds,
          usage: transcribing ?? { usedSeconds: 0, limitSeconds: 0, episodes: 0 },
        };
  const stop = transcriptionCopy.stop(offer, usage?.plan ?? "free", usage?.resetsOn ?? null);
  return <TranscriptionNotice notice={stop} route={stop.route} onFollowed={onFollowed} takeFocus />;
};

// Drawn as an everyday outcome: docs/features/podcast-screens.md, "Making one".
const NO_SPEECH_COPY: Record<NoSpeechReason, { heading: string; body: string }> = {
  "too-few-words": { heading: "There’s no speech in this to make an overview from", body: "Nothing was used." },
  "nothing-to-summarise": {
    heading: "This one is music or sound rather than talk",
    body: "So there’s nothing to make an overview from. Nothing was used.",
  },
};

interface NoSpeechProps {
  reason: NoSpeechReason;
  testId: string;
}

// Designs 130f, 130f-2: an honest stop, never counted, for any kind of source.
const NoSpeech = ({ reason, testId }: NoSpeechProps) => (
  <div className={styles.noTranscript} role="alert" data-testid={testId}>
    <span className={styles.rule} aria-hidden="true" />
    <h3 className={styles.noTranscriptHeading}>{NO_SPEECH_COPY[reason].heading}</h3>
    <p className={styles.noTranscriptBody}>{NO_SPEECH_COPY[reason].body}</p>
  </div>
);

const PodcastNoTranscript = ({ testId }: { testId: string }) => {
  return (
    <div className={styles.noTranscript} role="alert" data-testid={testId}>
      <span className={styles.rule} aria-hidden="true" />
      <h3 className={styles.noTranscriptHeading}>There’s no transcript for this episode yet</h3>
      <p className={styles.noTranscriptBody}>
        We found the episode, but we couldn’t find a transcript for it, and an overview is written from the words. Many episodes don’t have
        one yet. No overview was used.
      </p>
      <p className={styles.noTranscriptBody}>Have it on YouTube? Paste that link above, or another episode.</p>
    </div>
  );
};

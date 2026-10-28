import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { keyPromptDetail } from "../../transcripts/transcriptSourceNote.js";
import { LimitMessageNote } from "../../newOverview/components/LimitMessageNote/LimitMessageNote.js";
import { UsageLine } from "../../newOverview/components/UsageLine/UsageLine.js";
import { KeyPromptNote } from "../../apiKeys/components/KeyPromptNote/KeyPromptNote.js";
import { useStartFromLink } from "../../newOverview/useStartFromLink.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { LibraryPage } from "../../library/LibraryPage/LibraryPage.js";
import { OpeningLibrary } from "../../accountLibraries/components/OpeningLibrary/OpeningLibrary.js";
import { useSync } from "../../sync/SyncContext.js";
import { CapturePage } from "../../capture/CapturePage/CapturePage.js";
import { LibraryQueueGroup } from "../../captureQueue/components/LibraryQueueGroup/LibraryQueueGroup.js";
import styles from "./HomePage.module.scss";
import { homePageTestIds } from "./HomePageTestIds.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { PROVIDER_SHORT_LABEL } from "@overview/domain";
import { useAccountNeeded } from "../../accountLibraries/useAccountNeeded.js";
import { readOnboardingProgress } from "../../onboarding/onboardingProgressStorage.js";
import { startOnboarding } from "../../onboarding/useOnboardingProgress.js";
import { youTubeLink } from "../../newOverview/util/parseYouTubeUrl.js";
import { useTypingSettled } from "../../analytics/useTypingSettled.js";

// Home is the library everywhere but the side panel, where it is the one video the
// panel is beside (docs/features/extension-panel.md).
export function HomePage() {
  return useIsPanel() ? <CapturePage /> : <LibraryHome />;
}

function LibraryHome() {
  const accountNeeded = useAccountNeeded();
  // Onboarding under way on this device carries on where it was, signed out or just signed
  // in by its link (docs/features/onboarding.md, "Leaving and coming back").
  const onboarding = readOnboardingProgress();
  if (onboarding !== null && (accountNeeded || onboarding.overviewId !== null)) {
    return <Navigate to={Routes.onboarding()} replace />;
  }
  if (accountNeeded) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <StartHero />
      </div>
    );
  }
  return <SignedInHome />;
}

function SignedInHome() {
  const overviewsQuery = useOverviewsWithStateQuery();
  const sync = useSync();

  if (sync.opening) {
    return (
      <div className={styles.wide} data-testid={homePageTestIds.root}>
        <OpeningLibrary />
      </div>
    );
  }

  if (overviewsQuery.isPending) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <div className={styles.skeleton} data-testid={homePageTestIds.skeleton}>
          <div className={styles.skeletonBar} style={{ width: "60%" }} />
          <div className={styles.skeletonBar} style={{ width: "100%" }} />
          <div className={styles.skeletonBar} style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  if (overviewsQuery.isError) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <ErrorState screen="libraryLoad"
          title="Couldn't load your library"
          error={overviewsQuery.error}
          body="Something went wrong reading your saved overviews. Nothing has been lost."
          action={{ label: "Try again", onSelect: () => void overviewsQuery.refetch() }}
        />
      </div>
    );
  }

  if (overviewsQuery.data.length === 0) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <LibraryQueueGroup />
        <FirstRunHero />
      </div>
    );
  }

  return (
    <div className={styles.wide} data-testid={homePageTestIds.root}>
      <LibraryPage entries={overviewsQuery.data} />
    </div>
  );
}

// Design 2b/2c: the empty library has one job, which is to take a link. The field is the
// same run + New starts — it hands the URL to the shell's run and opens the dialog on the
// progress it makes — so there is one pipeline and one place a run lives
// (docs/features/stone-theme.md, "First run").
function FirstRunHero() {
  const { readiness, ready, limit, url, setUrl, validationError, generate } = useStartFromLink();
  const analytics = useAnalytics();
  const urlFieldId = useId();

  return (
    <Hero standfirst="Paste a YouTube URL. Get a succinct overview, with the main premise, key points, actionable steps and a verdict on if it's worth your time.">
      <form className={styles.heroForm} onSubmit={generate}>
        <span className={styles.heroFormIcon}>
          <StrokeIcon name="link" size={18} />
        </span>
        <input
          id={urlFieldId}
          name="video-url"
          type="url"
          autoComplete="off"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={styles.heroInput}
          placeholder="Paste a YouTube link"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={!ready}
          aria-label="YouTube link"
          data-testid={homePageTestIds.urlInput}
        />
        {limit === null && (
          <button
            type="submit"
            className={styles.heroGenerate}
            disabled={!ready}
            data-testid={homePageTestIds.generateButton}
          >
            Generate overview
          </button>
        )}
      </form>

      {validationError && (
        <p className={styles.heroError} data-testid={homePageTestIds.validationError}>
          {validationError}
        </p>
      )}

      {limit !== null ? (
        <LimitMessageNote message={limit} from="home" testIds={homePageTestIds.limitMessage} />
      ) : ready ? (
        <p className={styles.keysSaved} data-testid={homePageTestIds.keysSavedLine}>
          <StrokeIcon name="check" />
          Using your {PROVIDER_SHORT_LABEL[readiness.provider]} key ·{" "}
          <Link
            to={Routes.settingsSection("keys")}
            onClick={() => analytics.capture.newOverviewForm.keysLinkFollowed({ from: "home" })}
            data-testid={homePageTestIds.settingsLink}
          >
            Change keys
          </Link>
        </p>
      ) : (
        <div className={styles.keysNote} data-testid={homePageTestIds.keysNote}>
          <span className={styles.keysIcon}>
            <StrokeIcon name="key" size={17} />
          </span>
          <div className={styles.keysText}>
            <KeyPromptNote testIds={homePageTestIds.keyPrompt} readiness={readiness} detail={keyPromptDetail(readiness)} from="home" />
          </div>
        </div>
      )}

      {ready && limit === null && <UsageLine testIds={homePageTestIds.usageLine} />}
    </Hero>
  );
}

// Design 46a: signed out, the same hero is onboarding's Start. A video or playlist link goes
// straight on to the questions while its overview is made, and nothing else is offered: no
// overview is made or seen without an account (docs/features/onboarding.md).
function StartHero() {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const urlFieldId = useId();
  const [url, setUrl] = useState("");
  const [refused, setRefused] = useState(false);
  useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({ recognised: youTubeLink(url) !== null, from: "home" }),
  );

  const start = (event: FormEvent) => {
    event.preventDefault();
    const link = youTubeLink(url);
    const videoUrl = link === null ? null : link.kind === "playlist" ? null : link.videoUrl;
    if (link === null || (link.kind !== "playlist" && videoUrl === null)) {
      analytics.onboarding.start.linkRefused();
      setRefused(true);
      return;
    }
    analytics.onboarding.start.linkSubmitted({ kind: link.kind === "playlist" ? "playlist" : "video" });
    startOnboarding(url.trim(), videoUrl);
    void navigate(Routes.onboarding());
  };

  return (
    <Hero standfirst="Paste a YouTube link and we'll make your first overview: the main premise, key points, steps to apply and a verdict on whether it's worth your time, to read or listen to.">
      <form className={styles.heroForm} onSubmit={start}>
        <span className={styles.heroFormIcon}>
          <StrokeIcon name="link" size={18} />
        </span>
        <input
          id={urlFieldId}
          name="video-url"
          type="url"
          autoComplete="off"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={styles.heroInput}
          placeholder="Paste a YouTube video or playlist link"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setRefused(false);
          }}
          aria-label="YouTube link"
          aria-describedby={refused ? `${urlFieldId}-error` : undefined}
          data-testid={homePageTestIds.urlInput}
        />
        <button type="submit" className={styles.heroGenerate} data-testid={homePageTestIds.generateButton}>
          Make my overview
        </button>
      </form>
      {refused && (
        <p id={`${urlFieldId}-error`} className={styles.heroError} role="alert" data-testid={homePageTestIds.validationError}>
          We can't make an overview from that link yet. Try a YouTube video or playlist link.
        </p>
      )}
    </Hero>
  );
}

function Hero({ standfirst, children }: { standfirst: string; children: ReactNode }) {
  const surface = useSurface();
  return (
    <div className={styles.hero} data-testid={homePageTestIds.hero}>
      <div className={styles.heroText}>
        <h2 className={styles.heroTitle}>
          Watch Less,
          <br />
          <span className={styles.nowrap}>with The Overview</span>
        </h2>
        <p className={styles.heroStandfirst}>{standfirst}</p>

        {children}

        {surface === "extension" ? (
          <p className={styles.heroAside} data-testid={homePageTestIds.separateLibraryNote}>
            This is the extension's own library, kept separate from the web app's by the browser
            itself.
          </p>
        ) : (
          <div className={styles.extensionRow}>
            <span className={styles.youtubePill} aria-hidden="true">
              <svg viewBox="0 0 32 32" width="19" height="19" className={styles.youtubeMark}>
                <circle cx="16" cy="14.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
                <rect x="7" y="25" width="18" height="2.5" fill="currentColor" />
              </svg>
              Overview
            </span>
            <p className={styles.heroAside}>
              Or press <strong className={styles.heroStrong}>Overview</strong> under any YouTube
              video with the Chrome extension.
            </p>
            <button
              type="button"
              className={styles.getExtension}
              disabled
              title="The extension isn't in the Web Store yet"
              data-testid={homePageTestIds.getExtensionButton}
            >
              Get the extension
              <StrokeIcon name="arrowRight" size={14} />
            </button>
          </div>
        )}
      </div>

      <ExampleOverview />
    </div>
  );
}

// The design's own sample, so the first thing a new reader sees is what comes back. It is
// illustration, labelled as such, and every number in it is the design's rather than a
// measurement of anything (docs/prototype/constraints.md).
function ExampleOverview() {
  return (
    <aside className={styles.example} aria-label="Example overview" data-testid={homePageTestIds.exampleOverview}>
      <span className={styles.exampleBackTwo} aria-hidden="true" />
      <span className={styles.exampleBackOne} aria-hidden="true" />
      <article className={styles.exampleCard}>
        <div className={styles.exampleHead}>
          <span className={styles.exampleLabel}>Example overview</span>
          <span className={styles.exampleChip}>Common knowledge</span>
        </div>
        <div className={styles.exampleSource}>
          <span className={styles.exampleThumb} aria-hidden="true" />
          <div className={styles.exampleSourceText}>
            <p className={styles.exampleMeta}>TLDR News · 11:38 video</p>
            <p className={styles.exampleTitle}>Why the UK Economy Suddenly Looks Alright</p>
          </div>
        </div>
        <div className={styles.exampleSection}>
          <p className={styles.exampleSectionLabel}>Premise</p>
          <p className={styles.exampleBody}>
            A talking-head news explainer walking through three recent UK data points (GDP,
            productivity, hiring) that suggest the economy is turning a corner.
          </p>
        </div>
        <div className={styles.exampleSection}>
          <p className={styles.exampleSectionLabel}>Key points</p>
          <ul className={styles.examplePoints}>
            <li>Fastest GDP growth in the G7 in H1 2026, at 1.1%.</li>
            <li>Productivity, flat since 2008, is now estimated at 1.1–2% a year.</li>
            <li>Bond markets are less convinced; 30-year yields remain near historic highs.</li>
          </ul>
        </div>
        <div className={styles.examplePlayer} aria-hidden="true">
          <span className={styles.examplePlay}>
            <StrokeIcon name="play" size={13} />
          </span>
          <span className={styles.exampleTrack}>
            <span className={styles.exampleTrackFill} />
          </span>
          <span className={styles.exampleClock}>6 min listen</span>
        </div>
      </article>
    </aside>
  );
}

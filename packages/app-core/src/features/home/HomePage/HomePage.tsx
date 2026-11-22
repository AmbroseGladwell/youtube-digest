import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { keyPromptDetail } from "../../transcripts/transcriptSourceNote.js";
import { LimitMessageNote } from "../../newOverview/components/LimitMessageNote/LimitMessageNote.js";
import { UsageLine } from "../../newOverview/components/UsageLine/UsageLine.js";
import { KeyPromptNote } from "../../apiKeys/components/KeyPromptNote/KeyPromptNote.js";
import { createLabelOf } from "../../podcasts/util/episodeActionOf.js";
import { PastedLinkStatus } from "../../newOverview/components/PastedLinkStatus/PastedLinkStatus.js";
import { useStartFromLink } from "../../newOverview/useStartFromLink.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { LibraryPage } from "../../library/LibraryPage/LibraryPage.js";
import { WHOLE_LIBRARY, type LibraryPlace } from "../../library/types/LibraryPlace.js";
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
import { useStartOnboarding } from "../../onboarding/useStartOnboarding.js";
import { useStartSubject } from "../../onboarding/useStartSubject.js";
import { onboardingSourceOf } from "../../onboarding/onboardingSources.js";
import { REFUSED_LINK } from "../../onboarding/util/refusedLink.js";
import { OnboardingSamples } from "../../onboarding/components/OnboardingSamples/OnboardingSamples.js";
import { SampleDeck } from "../../onboarding/components/SampleDeck/SampleDeck.js";
import { StartVerb } from "../../onboarding/components/StartVerb/StartVerb.js";
import { mixedByKind } from "../../onboarding/util/mixedByKind.js";
import { useSamplesQuery } from "../../onboarding/queries/samplesQuery.js";
import { DEFAULT_START_VERB, sampleFacts } from "../../onboarding/util/sampleFacts.js";
import { SourceOffer } from "../../capture/components/SourceOffer/SourceOffer.js";
import { fromStart } from "../../auth/fromStart.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { CHROME_EXTENSION_URL } from "../../../util/chromeExtensionUrl.js";
import { useExtensionOffered } from "../../../util/useExtensionOffered.js";
import type { Sample } from "@overview/domain";
import { SignedOutGate } from "../../accountLibraries/components/SignedOutGate/SignedOutGate.js";
import { readAccountSeen } from "../../accountLibraries/accountSeenStorage.js";
import { isStartAsked } from "../../onboarding/startAsked.js";
import { useTypingSettled } from "../../analytics/useTypingSettled.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";

export const HomePage = ({ place = WHOLE_LIBRARY }: { place?: LibraryPlace }) => {
  const isPanel = useIsPanel();
  const accountNeeded = useAccountNeeded();
  const location = useLocation();
  // Why onboarding under way carries on: docs/features/onboarding.md, "The account".
  const onboarding = readOnboardingProgress();
  if (onboarding !== null && (accountNeeded || onboarding.overviewId !== null || onboarding.way !== null)) {
    return <Navigate to={Routes.onboarding()} replace />;
  }
  if (isPanel) {
    if (!accountNeeded) {
      return <CapturePage />;
    }
    if (readAccountSeen() && !isStartAsked(location.state)) {
      return <SignedOutGate panel />;
    }
    return (
      <div className={`${styles.root} ${styles.panel}`} data-testid={homePageTestIds.root}>
        <StartHero />
      </div>
    );
  }
  return <LibraryHome accountNeeded={accountNeeded} place={place} />;
};

interface LibraryHomeProps {
  accountNeeded: boolean;
  place: LibraryPlace;
}

const LibraryHome = ({ accountNeeded, place }: LibraryHomeProps) => {
  if (accountNeeded) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <StartHero />
      </div>
    );
  }
  return <SignedInHome place={place} />;
};

const SignedInHome = ({ place }: { place: LibraryPlace }) => {
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
        <ErrorState
          screen="libraryLoad"
          title="Couldn't load your library"
          error={overviewsQuery.error}
          body="Something went wrong reading your saved overviews. Nothing has been lost."
          action={{ label: "Try again", onSelect: () => void overviewsQuery.refetch() }}
        />
      </div>
    );
  }

  if (overviewsQuery.data.length === 0 && place.kind === "library") {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <LibraryQueueGroup />
        <FirstRunHero />
      </div>
    );
  }

  return (
    <div className={styles.wide} data-testid={homePageTestIds.root}>
      <LibraryPage entries={overviewsQuery.data} place={place} />
    </div>
  );
};

// Same run as + New, so one pipeline: docs/features/stone-theme.md, "What was built".
const FirstRunHero = () => {
  const { readiness, ready, limit, url, setUrl, validationError, generate, article, podcast, pasted } = useStartFromLink();
  const analytics = useAnalytics();
  const urlFieldId = useId();
  const linkName = article.available ? "YouTube, podcast or article link" : "YouTube link";

  const keysLine = () => {
    if (limit !== null) {
      return <LimitMessageNote message={limit} from="home" testIds={homePageTestIds.limitMessage} />;
    }
    return ready ? (
      <p className={styles.keysSaved} data-testid={homePageTestIds.keysSavedLine}>
        <StrokeIcon name="check" />
        Using your {PROVIDER_SHORT_LABEL[readiness.provider]} key ·{" "}
        <PageLink
          to={Routes.settingsSection("keys")}
          onClick={() => analytics.capture.newOverviewForm.keysLinkFollowed({ from: "home" })}
          data-testid={homePageTestIds.settingsLink}
        >
          Change keys
        </PageLink>
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
    );
  };

  return (
    <Hero
      standfirst={`Paste a ${article.available ? "YouTube, podcast or article link" : "YouTube URL"}. Get a succinct overview, with the main premise, the big picture, key points, actionable steps and a verdict on if it's worth your time.`}
    >
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
          placeholder={`Paste a ${linkName}`}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={!ready}
          aria-label={linkName}
          data-testid={homePageTestIds.urlInput}
        />
        {limit === null && pasted.generateOffered && (
          <button
            type="submit"
            className={styles.heroGenerate}
            disabled={!ready || pasted.reading}
            data-testid={homePageTestIds.generateButton}
          >
            {pasted.episodeAction === null ? "Generate overview" : createLabelOf(pasted.episodeAction, "Generate overview")}
          </button>
        )}
      </form>

      <PastedLinkStatus article={article} podcast={podcast} url={url.trim()} onClear={() => setUrl("")} />

      {validationError && (
        <p className={styles.heroError} data-testid={homePageTestIds.validationError}>
          {validationError}
        </p>
      )}

      {keysLine()}

      {ready && limit === null && <UsageLine testIds={homePageTestIds.usageLine} />}
    </Hero>
  );
};

// Fewer than this and there's no deck to cycle, so the samples are plain rows (155l).
const DECK_LEAST = 3;

const StartHero = () => {
  const isPanel = useIsPanel();
  const subject = useStartSubject();
  const startOnboarding = useStartOnboarding();
  const location = useLocation();
  const phone = useIsPhone();
  const samples = useSamplesQuery().data ?? [];
  const [front, setFront] = useState<Sample | null>(null);
  const deck = useMemo(() => mixedByKind(samples), [samples]);
  // A random first card each visit, so no one kind leads (327b).
  const [firstCard] = useState(() => Math.random());
  const firstIndex = deck.length === 0 ? 0 : Math.floor(firstCard * deck.length);
  const shownFirst = front ?? deck[firstIndex] ?? null;
  const analytics = useAnalytics();
  const urlFieldId = useId();
  const [url, setUrl] = useState("");
  const [refused, setRefused] = useState(false);
  const [pasting, setPasting] = useState(false);
  const settleTyping = useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({ recognised: onboardingSourceOf(url) !== null, from: "home" }),
  );

  const start = (event: FormEvent) => {
    event.preventDefault();
    settleTyping();
    setRefused(!startOnboarding(url));
  };

  // One way in on screen at a time: the offer takes the field's place until "paste a different link".
  const offered = subject !== null && !pasting;
  const deckVerb = shownFirst === null || samples.length < DECK_LEAST ? DEFAULT_START_VERB : sampleFacts(shownFirst.note).verb;
  const samplesAside = () => {
    if (samples.length >= DECK_LEAST) {
      return <SampleDeck samples={deck} firstIndex={firstIndex} phone={phone} onFront={setFront} />;
    }
    if (samples.length > 0) {
      return <OnboardingSamples samples={samples} />;
    }
    return isPanel ? null : <ExampleOverview />;
  };

  return (
    <Hero
      standfirst={
        offered
          ? `Make this ${subject.noun} your first overview. We'll set up your account as we go.`
          : "Save what you care about, get an overview plus personalised actions, and build a knowledge base you and your AI can use."
      }
      verb={<StartVerb verb={offered ? subject.verb : deckVerb} />}
      note={
        !isPanel && isStartAsked(location.state) ? (
          <p className={styles.fromCreate} data-testid={homePageTestIds.fromCreateNote}>
            <StrokeIcon name="user" size={14} />
            New accounts start with your first overview
          </p>
        ) : null
      }
      alignTop={samples.length > 0 && samples.length < DECK_LEAST}
      panel={isPanel}
      aside={samplesAside()}
    >
      {offered ? (
        <div className={styles.offered}>
          {subject.offer !== null && <SourceOffer source={subject.offer.source} title={subject.offer.title} video={subject.offer.video} />}
          <button type="button" className={styles.heroMake} onClick={subject.make} data-testid={homePageTestIds.generateButton}>
            Make my overview
          </button>
          <button type="button" className={styles.pasteLink} onClick={() => setPasting(true)} data-testid={homePageTestIds.pasteLink}>
            Or paste a different link
          </button>
        </div>
      ) : (
        <>
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
              placeholder="Paste a link to a video, page or episode"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setRefused(false);
              }}
              aria-label="Link"
              aria-describedby={refused ? `${urlFieldId}-error` : undefined}
              data-testid={homePageTestIds.urlInput}
            />
            <button type="submit" className={styles.heroGenerate} data-testid={homePageTestIds.generateButton}>
              Make my overview
            </button>
          </form>
          {refused ? (
            <p id={`${urlFieldId}-error`} className={styles.heroError} role="alert" data-testid={homePageTestIds.validationError}>
              {REFUSED_LINK}
            </p>
          ) : (
            <p className={styles.accepted} data-testid={homePageTestIds.accepted}>
              YouTube, any web page, Apple Podcasts or Spotify.
            </p>
          )}
        </>
      )}

      {isPanel && (
        <PageLink className={styles.signIn} to={Routes.signIn()} state={fromStart} data-testid={homePageTestIds.signIn}>
          Sign in
        </PageLink>
      )}
    </Hero>
  );
};

interface HeroProps {
  standfirst: string;
  children: ReactNode;
  verb?: ReactNode;
  note?: ReactNode;
  aside?: ReactNode;
  // A list of samples grows, so the text stays at the top; the fixed deck stays centred (155b).
  alignTop?: boolean;
  // The panel's one column has no room for the aside, and the reader is in the extension already.
  panel?: boolean;
}

const Hero = ({
  standfirst,
  children,
  verb = "Watch Less,",
  note = null,
  aside = <ExampleOverview />,
  alignTop = false,
  panel = false,
}: HeroProps) => {
  const surface = useSurface();
  const extensionOffered = useExtensionOffered();
  const extensionLine = () => {
    if (panel) {
      return null;
    }
    if (surface === "extension") {
      return (
        <p className={styles.heroAside} data-testid={homePageTestIds.separateLibraryNote}>
          This is the extension's own library, kept separate from the web app's by the browser itself.
        </p>
      );
    }
    return extensionOffered ? (
      <div className={styles.extensionRow}>
        <span className={styles.youtubePill} aria-hidden="true">
          <svg viewBox="0 0 32 32" width="19" height="19" className={styles.youtubeMark}>
            <circle cx="16" cy="14.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
            <rect x="7" y="25" width="18" height="2.5" fill="currentColor" />
          </svg>
          Overview
        </span>
        <p className={styles.heroAside}>Add content in 1 click with the extension.</p>
        <a
          className={styles.getExtension}
          href={CHROME_EXTENSION_URL}
          target="_blank"
          rel="noopener"
          data-testid={homePageTestIds.getExtensionLink}
        >
          Get the extension
          <StrokeIcon name="arrowRight" size={14} />
        </a>
      </div>
    ) : null;
  };
  return (
    <div className={alignTop ? `${styles.hero} ${styles.heroTop}` : styles.hero} data-testid={homePageTestIds.hero}>
      <div className={styles.heroText}>
        {note}
        <h2 className={styles.heroTitle} data-testid={homePageTestIds.heroTitle}>
          {verb}
          <br />
          <span className={styles.nowrap}>with The Overview</span>
        </h2>
        <p className={styles.heroStandfirst}>{standfirst}</p>

        {children}

        {extensionLine()}
      </div>

      {aside}
    </div>
  );
};

// Illustration: every number in it is the design's, not a measurement (docs/prototype/constraints.md).
const ExampleOverview = () => {
  return (
    <aside className={styles.example} aria-label="Example overview" data-testid={homePageTestIds.exampleOverview}>
      <span className={styles.exampleBackTwo} aria-hidden="true" />
      <span className={styles.exampleBackOne} aria-hidden="true" />
      <article className={styles.exampleCard}>
        <div className={styles.exampleHead}>
          <span className={styles.exampleLabel}>Example overview</span>
          <span className={styles.exampleChip}>Widely covered</span>
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
            A talking-head news explainer walking through three recent UK data points (GDP, productivity, hiring) that suggest the economy
            is turning a corner.
          </p>
        </div>
        <div className={styles.exampleSection}>
          <p className={styles.exampleSectionLabel}>Big picture</p>
          <p className={styles.exampleBody}>
            After years of gloomy forecasts, the question is whether three good readings mark a real turn or a blip, and why investors are
            slower to believe it than the data.
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
};

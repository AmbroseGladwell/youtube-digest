import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { keyPromptDetail } from "../../transcripts/transcriptSourceNote.js";
import { LimitMessageNote } from "../../newOverview/components/LimitMessageNote/LimitMessageNote.js";
import { UsageLine } from "../../newOverview/components/UsageLine/UsageLine.js";
import { KeyPromptNote } from "../../apiKeys/components/KeyPromptNote/KeyPromptNote.js";
import { PastedLinkStatus } from "../../newOverview/components/PastedLinkStatus/PastedLinkStatus.js";
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
import { useStartOnboarding } from "../../onboarding/useStartOnboarding.js";
import { useStartSubject } from "../../onboarding/useStartSubject.js";
import { onboardingSourceOf } from "../../onboarding/onboardingSources.js";
import { REFUSED_LINK } from "../../onboarding/util/refusedLink.js";
import { OnboardingSamples } from "../../onboarding/components/OnboardingSamples/OnboardingSamples.js";
import { SampleDeck } from "../../onboarding/components/SampleDeck/SampleDeck.js";
import { StartVerb } from "../../onboarding/components/StartVerb/StartVerb.js";
import { useSamplesQuery } from "../../onboarding/queries/samplesQuery.js";
import { DEFAULT_START_VERB, sampleFacts } from "../../onboarding/util/sampleFacts.js";
import { SourceOffer } from "../../capture/components/SourceOffer/SourceOffer.js";
import { fromStart } from "../../auth/fromStart.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { CHROME_EXTENSION_URL } from "../../../util/chromeExtensionUrl.js";
import type { Sample } from "@overview/domain";
import { SignedOutGate } from "../../accountLibraries/components/SignedOutGate/SignedOutGate.js";
import { readAccountSeen } from "../../accountLibraries/accountSeenStorage.js";
import { isStartAsked } from "../../onboarding/startAsked.js";
import { useTypingSettled } from "../../analytics/useTypingSettled.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";

// Home is the library everywhere but the side panel, where it is the one video the
// panel is beside (docs/features/extension-panel.md).
// Signed out where there are accounts, home is onboarding's Start, in the panel as on the
// web (205g), or, once this device has had an account, the way back into it unless Create
// account asked for Start (docs/features/onboarding.md).
export function HomePage() {
  const isPanel = useIsPanel();
  const accountNeeded = useAccountNeeded();
  const location = useLocation();
  // Onboarding under way on this device carries on where it was, signed out or just signed
  // in from its account screen, with the overview made or still on its way
  // (docs/features/onboarding.md, "The account").
  const onboarding = readOnboardingProgress();
  if (onboarding !== null && (accountNeeded || onboarding.overviewId !== null || onboarding.way !== null)) {
    return <Navigate to={Routes.onboarding()} replace />;
  }
  if (isPanel) {
    if (!accountNeeded) return <CapturePage />;
    if (readAccountSeen() && !isStartAsked(location.state)) return <SignedOutGate panel />;
    return (
      <div className={`${styles.root} ${styles.panel}`} data-testid={homePageTestIds.root}>
        <StartHero />
      </div>
    );
  }
  return <LibraryHome accountNeeded={accountNeeded} />;
}

function LibraryHome({ accountNeeded }: { accountNeeded: boolean }) {
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
  const { readiness, ready, limit, url, setUrl, validationError, generate, article, podcast, pasted } = useStartFromLink();
  const analytics = useAnalytics();
  const urlFieldId = useId();
  const linkName = article.available ? "YouTube, podcast or article link" : "YouTube link";

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
            Generate overview
          </button>
        )}
      </form>

      <PastedLinkStatus article={article} podcast={podcast} url={url.trim()} onClear={() => setUrl("")} />

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
      )}

      {ready && limit === null && <UsageLine testIds={homePageTestIds.usageLine} />}
    </Hero>
  );
}

// Fewer than this and there's no deck to cycle, so the samples are plain rows (155l).
const DECK_LEAST = 3;

// Design 46a: signed out, the same hero is onboarding's Start. A link we can read goes
// straight on to the questions while its overview is made, or a sample starts them around one
// already made. Nothing else is offered: no overview is made or seen without an account
// (docs/features/onboarding.md).
// In the panel it is the same screen compressed (205g): the tab is the subject, the headline's
// verb follows it, and Sign in stands under Make my overview as a peer rather than a line.
function StartHero() {
  const isPanel = useIsPanel();
  const subject = useStartSubject();
  const startOnboarding = useStartOnboarding();
  const location = useLocation();
  const phone = useIsPhone();
  const samples = useSamplesQuery().data ?? [];
  const [front, setFront] = useState<Sample | null>(null);
  const shownFirst = front ?? samples[0] ?? null;
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

  // Beside something, the offer takes the field's place; "Or paste a different link" swaps
  // them back, so there is one way in on screen at a time.
  const offered = subject !== null && !pasting;
  const deckVerb = shownFirst === null || samples.length < DECK_LEAST ? DEFAULT_START_VERB : sampleFacts(shownFirst.note).verb;

  return (
    <Hero
      standfirst={
        offered
          ? `Make this ${subject.noun} your first overview. We'll set up your account as we go.`
          : isPanel
            ? "Paste a link, or open a video or page you've been meaning to get to. We'll make it your first overview, to read or listen to, and set up your account as we go."
            : "Paste a link to a video or a page you've been meaning to get to, and we'll make your first overview of it, to read or listen to."
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
      alignTop={samples.length > 0}
      panel={isPanel}
      aside={
        samples.length >= DECK_LEAST ? (
          <SampleDeck samples={samples} phone={phone} onFront={setFront} />
        ) : samples.length > 0 ? (
          <OnboardingSamples samples={samples} />
        ) : isPanel ? null : (
          <ExampleOverview />
        )
      }
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
              placeholder="Paste a link to a video or a page"
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
          {refused && (
            <p id={`${urlFieldId}-error`} className={styles.heroError} role="alert" data-testid={homePageTestIds.validationError}>
              {REFUSED_LINK}
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
}

interface HeroProps {
  standfirst: string;
  children: ReactNode;
  verb?: ReactNode;
  note?: ReactNode;
  aside?: ReactNode;
  // Start's deck grows when it's laid out as a list, so the text stays at the top (155b).
  alignTop?: boolean;
  // The panel is one narrow column with no room for the extension's own aside, and the
  // extension is where it already is (205g).
  panel?: boolean;
}

function Hero({
  standfirst,
  children,
  verb = "Watch Less,",
  note = null,
  aside = <ExampleOverview />,
  alignTop = false,
  panel = false,
}: HeroProps) {
  const surface = useSurface();
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

        {panel ? null : surface === "extension" ? (
          <p className={styles.heroAside} data-testid={homePageTestIds.separateLibraryNote}>
            This is the extension's own library, kept separate from the web app's by the browser itself.
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
              Or press <strong className={styles.heroStrong}>Overview</strong> under any YouTube video with the Chrome extension.
            </p>
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
        )}
      </div>

      {aside}
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
}

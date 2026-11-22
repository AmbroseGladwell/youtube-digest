import { useCallback, useMemo, useState, type ReactNode } from "react";
import { sourceKey, type TranscribeChoice } from "@overview/domain";
import { useLibraryMove } from "../accountLibraries/LibraryMoveContext.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { OnboardingRunProvider, type OnboardingRunState } from "./OnboardingRunContext.js";
import { onboardingSourceOf } from "./onboardingSources.js";
import { onboardingTabId } from "./onboardingTab.js";
import { useOnboardingProgress } from "./useOnboardingProgress.js";
import { useOnboardingRun, type OnboardingRun } from "./useOnboardingRun.js";
import { useOnboardingRunOwner } from "./useOnboardingRunOwner.js";

// Onboarding's run, above the router so it outlives the page: the web's sign-in lands on
// home and comes back, and going home mid-run comes back too, neither of which should start
// the overview over. One tab has it; the others ask after it and take it over if that tab
// is gone. Nothing is spent until the account exists and the answers are moved into it
// (docs/features/onboarding.md, "The run lives in one tab" and "Nothing paid before the account").
export const OnboardingRunRuntime = ({ children }: { children: ReactNode }) => {
  const [progress, update] = useOnboardingProgress();
  const libraryMove = useLibraryMove();
  const accountId = useLibraryAccountId();
  const [attempt, setAttempt] = useState(0);
  // The link the reader chose to transcribe, and whether this is a try again; another link asks again.
  const [transcribing, setTranscribing] = useState<{ link: string; choice: TranscribeChoice } | null>(null);
  const kind = useMemo(() => (progress === null ? null : (onboardingSourceOf(progress.link)?.source ?? null)), [progress]);
  const link = progress?.link ?? null;
  const wanted = progress !== null && progress.share === null && progress.overviewId === null && kind !== null;
  const mine = progress !== null && progress.runner === onboardingTabId();
  // The answers have been given, and the account they were moved into exists (OV-327).
  const maySpend = (progress?.mayWrite ?? false) && accountId !== null && libraryMove.answersIn === accountId;
  const claim = useCallback(() => {
    if (wanted) {
      update({ runner: onboardingTabId() });
    }
  }, [wanted, update]);

  const run = useOnboardingRun({
    source: kind,
    target: wanted && mine && progress !== null && kind !== null ? kind.target(progress) : null,
    tabId: progress?.tabId ?? null,
    maySpend,
    attempt,
    transcribe: link !== null && transcribing?.link === link ? transcribing.choice : undefined,
    onFound: (found) => {
      if (progress?.sourceKey === null) {
        update({ sourceKey: sourceKey(found.source) });
      }
    },
    onMade: (overview) => update({ overviewId: overview.id }),
  });
  const held = useOnboardingRunOwner({ link, wanted, mine, phase: run.phase, claim });

  const value = useMemo((): OnboardingRunState => {
    const shown: OnboardingRun = mine
      ? run
      : {
          phase: held?.phase ?? "writing",
          found: null,
          overview: null,
          failure: null,
          transcription: null,
          sourceWords: null,
          writingStarted: false,
        };
    return {
      run: shown,
      mine,
      attempt,
      retry: () => {
        if (!mine) {
          claim();
        }
        setAttempt((current) => current + 1);
      },
      transcribe: () => {
        if (!mine) {
          claim();
        }
        if (link !== null) {
          setTranscribing({ link, choice: transcribing?.link === link ? "retried" : "asked" });
        }
        setAttempt((current) => current + 1);
      },
    };
  }, [run, mine, held, attempt, claim, link, transcribing]);

  return <OnboardingRunProvider value={value}>{children}</OnboardingRunProvider>;
};

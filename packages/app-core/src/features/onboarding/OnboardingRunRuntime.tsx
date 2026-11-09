import { useCallback, useMemo, useState, type ReactNode } from "react";
import { sourceKey } from "@overview/domain";
import { useLibraryMove } from "../accountLibraries/LibraryMoveContext.js";
import { OnboardingRunProvider, type OnboardingRunState } from "./OnboardingRunContext.js";
import { onboardingSourceOf } from "./onboardingSources.js";
import { onboardingTabId } from "./onboardingTab.js";
import { useOnboardingProgress } from "./useOnboardingProgress.js";
import { useOnboardingRun, type OnboardingRun } from "./useOnboardingRun.js";
import { useOnboardingRunOwner } from "./useOnboardingRunOwner.js";

// Onboarding's run, above the router so it outlives the page: the web's sign-in lands on
// home and comes back, and going home mid-run comes back too, neither of which should start
// the overview over. One tab has it; the others ask after it and take it over if that tab
// is gone. When it lands after the reader has signed in, the move brings it into the
// account (docs/features/onboarding.md, "The run lives in one tab" and "Into the account").
export function OnboardingRunRuntime({ children }: { children: ReactNode }) {
  const [progress, update] = useOnboardingProgress();
  const libraryMove = useLibraryMove();
  const [attempt, setAttempt] = useState(0);
  const kind = useMemo(() => (progress === null ? null : (onboardingSourceOf(progress.link)?.source ?? null)), [progress]);
  const link = progress?.link ?? null;
  const wanted = progress !== null && progress.share === null && progress.overviewId === null && kind !== null;
  const mine = progress !== null && progress.runner === onboardingTabId();
  const claim = useCallback(() => {
    if (wanted) update({ runner: onboardingTabId() });
  }, [wanted, update]);

  const run = useOnboardingRun({
    source: kind,
    target: wanted && mine && progress !== null && kind !== null ? kind.target(progress) : null,
    tabId: progress?.tabId ?? null,
    mayWrite: progress?.mayWrite ?? false,
    attempt,
    onFound: (found) => {
      if (progress?.sourceKey === null) update({ sourceKey: sourceKey(found.source) });
    },
    onMade: (overview) => {
      update({ overviewId: overview.id });
      libraryMove.moveAgain();
    },
  });
  const held = useOnboardingRunOwner({ link, wanted, mine, phase: run.phase, claim });

  const value = useMemo((): OnboardingRunState => {
    const shown: OnboardingRun = mine ? run : { phase: held?.phase ?? "writing", found: null, overview: null, failure: null };
    return {
      run: shown,
      mine,
      attempt,
      retry: () => {
        if (!mine) claim();
        setAttempt((current) => current + 1);
      },
    };
  }, [run, mine, held, attempt, claim]);

  return <OnboardingRunProvider value={value}>{children}</OnboardingRunProvider>;
}

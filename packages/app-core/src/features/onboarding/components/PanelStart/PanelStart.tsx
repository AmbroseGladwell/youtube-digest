import { useId, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { domainOf } from "@overview/domain";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { useActivePage, useArticlePages } from "../../../../app/ArticlePagesContext.js";
import { Routes } from "../../../../app/Routes.js";
import { rememberPageAccess } from "../../pageAccess.js";
import { REFUSED_LINK } from "../../util/refusedLink.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { OnboardingSamples } from "../OnboardingSamples/OnboardingSamples.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { readAccountSeen } from "../../../accountLibraries/accountSeenStorage.js";
import { useSamplesQuery } from "../../queries/samplesQuery.js";
import { isStartAsked } from "../../startAsked.js";
import { useStartOnboarding } from "../../useStartOnboarding.js";
import styles from "./PanelStart.module.scss";
import { panelStartTestIds } from "./PanelStartTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { shouldAnimateNavigation } from "../../../../util/viewTransitions.js";

// Designs 46n and 154b: in the panel, Start offers what it's beside rather than a field, with
// any other link a tap away. Beside a page it can't yet tell an article from a recipe, so it
// says "this page" and shows what the tab gives; the page is read in the browser, so Chrome is
// asked inside the click. On a tab with nothing to read, the field is the way in
// (docs/features/onboarding.md, "In the extension panel"). Samples follow, three at a time
// (155d). Reached from Create account, the lead says why it isn't a form, and on a device that
// has had an account Back returns to signing in (155e).
export function PanelStart() {
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const pages = useArticlePages();
  const startOnboarding = useStartOnboarding();
  const nothingBeside = activeVideoUrl === null && activePage === null;
  const [pasting, setPasting] = useState(false);
  const [link, setLink] = useState("");
  const [refused, setRefused] = useState(false);
  const fieldId = useId();
  const navigate = useNavigate();
  const fromCreate = isStartAsked(useLocation().state);
  const samples = useSamplesQuery().data ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setRefused(!startOnboarding(link));
  };

  const makeFromBeside = () => {
    if (activeVideoUrl !== null) {
      startOnboarding(activeVideoUrl);
    } else if (activePage !== null && pages !== null) {
      rememberPageAccess(activePage.url, pages.requestAccess(activePage.url));
      startOnboarding(activePage.url, activePage.tabId);
    }
  };

  return (
    <div className={styles.root} data-testid={panelStartTestIds.root}>
      {fromCreate && readAccountSeen() && (
        <button
          type="button"
          className={styles.backToSignIn}
          aria-label="Back to sign in"
          onClick={() => void navigate(Routes.signIn(), { viewTransition: shouldAnimateNavigation() })}
          data-testid={panelStartTestIds.backToSignIn}
        >
          <StrokeIcon name="chevronLeft" size={18} />
        </button>
      )}
      <div className={styles.intro}>
        <OnboardingHeading>
          {activeVideoUrl !== null ? "Make an overview of this video" : activePage !== null ? "Make an overview of this page" : "Paste a link to start"}
        </OnboardingHeading>
        <p className={styles.lead}>
          {leadFor(activeVideoUrl !== null ? "video" : activePage !== null ? "page" : null, fromCreate, samples.length > 0)}
        </p>
      </div>

      {activeVideoUrl === null && activePage !== null && (
        <div className={styles.page} data-testid={panelStartTestIds.page}>
          <span className={styles.tile} aria-hidden="true">
            {domainOf(activePage.url)}
          </span>
          <span className={styles.pageMeta}>
            <span className={styles.site}>{domainOf(activePage.url)}</span>
            <span className={styles.pageTitle}>{activePage.title}</span>
          </span>
        </div>
      )}

      {(pasting || nothingBeside) && (
        <form id={fieldId} className={styles.form} onSubmit={submit}>
          <label htmlFor={`${fieldId}-input`} className={styles.label}>
            Link
          </label>
          <span className={styles.field}>
            <input
              id={`${fieldId}-input`}
              className={styles.input}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Paste a link to a video or a page"
              value={link}
              onChange={(event) => {
                setLink(event.target.value);
                setRefused(false);
              }}
              data-testid={panelStartTestIds.linkField}
            />
            {!nothingBeside && (
              <button type="submit" className={styles.go} disabled={link.trim() === ""} data-testid={panelStartTestIds.linkSubmit}>
                Make it
              </button>
            )}
          </span>
          {refused && (
            <p className={styles.refused} role="alert" data-testid={panelStartTestIds.refused}>
              {REFUSED_LINK}
            </p>
          )}
        </form>
      )}

      <div className={styles.actions}>
        {nothingBeside ? (
          <button
            type="submit"
            form={fieldId}
            className={styles.primary}
            disabled={link.trim() === ""}
            data-testid={panelStartTestIds.makeOverview}
          >
            Make my overview
          </button>
        ) : (
          <button type="button" className={styles.primary} onClick={makeFromBeside} data-testid={panelStartTestIds.makeOverview}>
            Make my overview
          </button>
        )}
        {!pasting && !nothingBeside && (
          <button type="button" className={styles.quiet} onClick={() => setPasting(true)} data-testid={panelStartTestIds.pasteLink}>
            Or paste a different link
          </button>
        )}
      </div>

      {samples.length > 0 && <OnboardingSamples samples={samples} />}

      <div className={styles.foot}>
        <PageLink className={styles.quiet} to={Routes.signIn()} data-testid={panelStartTestIds.signIn}>
          Already have an account? Sign in
        </PageLink>
      </div>
    </div>
  );
}

function leadFor(beside: "video" | "page" | null, fromCreate: boolean, samples: boolean): string {
  if (beside === null) {
    return samples
      ? "There's nothing on this tab we can make an overview of. Paste a link, or try a sample."
      : "There's nothing on this tab we can make an overview of. Paste a link to a video or a page, or open one and come back.";
  }
  if (fromCreate) {
    return `New accounts start with your first overview. Make one of this ${beside}${samples ? ", or try a sample" : ""}.`;
  }
  return `We'll make your first overview from the ${beside} you're on.`;
}

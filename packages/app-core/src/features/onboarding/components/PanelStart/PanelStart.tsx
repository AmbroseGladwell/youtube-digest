import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { domainOf } from "@overview/domain";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { useActivePage, useArticlePages } from "../../../../app/ArticlePagesContext.js";
import { Routes } from "../../../../app/Routes.js";
import { rememberPageAccess } from "../../pageAccess.js";
import { REFUSED_LINK } from "../../util/refusedLink.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { OnboardingSamples } from "../OnboardingSamples/OnboardingSamples.js";
import { useStartOnboarding } from "../../useStartOnboarding.js";
import styles from "./PanelStart.module.scss";
import { panelStartTestIds } from "./PanelStartTestIds.js";

// Designs 46n and 154b: in the panel, Start offers what it's beside rather than a field, with
// any other link a tap away. Beside a page it can't yet tell an article from a recipe, so it
// says "this page" and shows what the tab gives; the page is read in the browser, so Chrome is
// asked inside the click. On a tab with nothing to read, the field is the way in
// (docs/features/onboarding.md, "In the extension panel").
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
      <div className={styles.intro}>
        <OnboardingHeading>
          {activeVideoUrl !== null ? "Make an overview of this video" : activePage !== null ? "Make an overview of this page" : "Paste a link to start"}
        </OnboardingHeading>
        <p className={styles.lead}>
          {activeVideoUrl !== null
            ? "We'll make your first overview from the video you're on."
            : activePage !== null
              ? "We'll make your first overview from the page you're on."
              : "There's nothing on this tab we can make an overview of. Paste a link to a video or a page, or open one and come back."}
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

      <OnboardingSamples />

      <div className={styles.foot}>
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
        <Link className={styles.quiet} to={Routes.signIn()} data-testid={panelStartTestIds.signIn}>
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}

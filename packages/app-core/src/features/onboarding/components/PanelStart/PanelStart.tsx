import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { Routes } from "../../../../app/Routes.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { useStartOnboarding } from "../../useStartOnboarding.js";
import styles from "./PanelStart.module.scss";
import { panelStartTestIds } from "./PanelStartTestIds.js";

// Design 46n: in the panel, Start offers the video it is beside rather than a field, with any
// other link a tap away. The video itself is shown on the next screen once it has resolved
// (docs/features/onboarding.md, "In the extension panel").
export function PanelStart() {
  const activeVideoUrl = useActiveVideoUrl();
  const startOnboarding = useStartOnboarding();
  const [pasting, setPasting] = useState(false);
  const [link, setLink] = useState("");
  const [refused, setRefused] = useState(false);
  const fieldId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setRefused(!startOnboarding(link));
  };

  return (
    <div className={styles.root} data-testid={panelStartTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Make an overview of this video</OnboardingHeading>
        <p className={styles.lead}>
          {activeVideoUrl === null
            ? "Open a YouTube video beside this panel and we'll make your first overview from it."
            : "We'll make your first overview from the video you're on."}
        </p>
      </div>

      {pasting && (
        <form className={styles.form} onSubmit={submit}>
          <label htmlFor={fieldId} className={styles.label}>
            YouTube link
          </label>
          <span className={styles.field}>
            <input
              id={fieldId}
              className={styles.input}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Paste a YouTube video or playlist link"
              value={link}
              onChange={(event) => {
                setLink(event.target.value);
                setRefused(false);
              }}
              data-testid={panelStartTestIds.linkField}
            />
            <button type="submit" className={styles.go} disabled={link.trim() === ""} data-testid={panelStartTestIds.linkSubmit}>
              Make it
            </button>
          </span>
          {refused && (
            <p className={styles.refused} role="alert" data-testid={panelStartTestIds.refused}>
              We can't make an overview from that link yet. Try a YouTube video or playlist link.
            </p>
          )}
        </form>
      )}

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.primary}
          disabled={activeVideoUrl === null}
          onClick={() => activeVideoUrl !== null && startOnboarding(activeVideoUrl)}
          data-testid={panelStartTestIds.makeOverview}
        >
          Make my overview
        </button>
        {!pasting && (
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

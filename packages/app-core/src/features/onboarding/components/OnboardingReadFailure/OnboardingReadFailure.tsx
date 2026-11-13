import { useId, useState, type FormEvent } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OnboardingFailureCopy } from "../../util/onboardingFailureCopy.js";
import { REFUSED_LINK } from "../../util/refusedLink.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingReadFailure.module.scss";
import { onboardingReadFailureTestIds } from "./OnboardingReadFailureTestIds.js";

export interface OnboardingReadFailureProps {
  copy: OnboardingFailureCopy;
  link: string;
  onTryAgain: () => void;
  // Says whether the link was taken.
  onAnotherLink: (link: string) => boolean;
}

// Designs 154l–154n, pattern 19 at the confirm step: a short bar, what happened, the link that
// was pasted, and a field for another. The free overview is what's untouched, so the foot says
// that rather than that nothing counted.
export function OnboardingReadFailure({ copy, link, onTryAgain, onAnotherLink }: OnboardingReadFailureProps) {
  const [another, setAnother] = useState("");
  const [refused, setRefused] = useState(false);
  const fieldId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setRefused(!onAnotherLink(another));
  };

  return (
    <div className={styles.root} data-testid={onboardingReadFailureTestIds.root}>
      <span className={styles.bar} aria-hidden="true" />
      <div className={styles.intro}>
        <OnboardingHeading key={copy.title}>{copy.title}</OnboardingHeading>
        <p className={styles.lead}>{copy.body}</p>
      </div>

      <p className={styles.link} data-testid={onboardingReadFailureTestIds.link}>
        <StrokeIcon name="link" size={14} />
        <span className={styles.linkText}>{link.replace(/^https?:\/\/(www\.)?/, "")}</span>
      </p>

      {copy.tryAgain && (
        <button type="button" className={styles.tryAgain} onClick={onTryAgain} data-testid={onboardingReadFailureTestIds.tryAgain}>
          <StrokeIcon name="refresh" size={15} />
          Try again
        </button>
      )}

      {copy.comingSoon && (
        <p className={styles.comingSoon} data-testid={onboardingReadFailureTestIds.comingSoon}>
          <StrokeIcon name="mic" size={14} />
          Transcribing is coming soon
        </p>
      )}

      <form id={`${fieldId}-form`} className={styles.form} onSubmit={submit}>
        <label htmlFor={fieldId} className={styles.label}>
          {copy.videoOnly ? "Try a video link" : "Try another link"}
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
            placeholder={copy.videoOnly ? "Paste a video link" : "Paste a link to a video or a page"}
            value={another}
            aria-describedby={refused ? `${fieldId}-refused` : undefined}
            onChange={(event) => {
              setAnother(event.target.value);
              setRefused(false);
            }}
            data-testid={onboardingReadFailureTestIds.linkField}
          />
          <button type="submit" className={styles.go} disabled={another.trim() === ""} data-testid={onboardingReadFailureTestIds.submit}>
            Make my overview
          </button>
        </span>
        {refused && (
          <p id={`${fieldId}-refused`} className={styles.refused} role="alert">
            {REFUSED_LINK}
          </p>
        )}
      </form>

      {copy.extension !== null && (
        <p className={styles.aside} data-testid={onboardingReadFailureTestIds.extension}>
          {copy.extension}
        </p>
      )}
      <div className={styles.foot}>
        <button type="submit" form={`${fieldId}-form`} className={styles.footGo} disabled={another.trim() === ""}>
          Make my overview
        </button>
        <p className={styles.aside}>Your free overview hasn't been used.</p>
      </div>
    </div>
  );
}

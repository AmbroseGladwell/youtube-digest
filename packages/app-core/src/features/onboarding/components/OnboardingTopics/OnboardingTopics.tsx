import { useId, useState, type FormEvent } from "react";
import { sameTopicName, STARTER_TOPICS } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingTopics.module.scss";
import { onboardingTopicsTestIds } from "./OnboardingTopicsTestIds.js";

export interface OnboardingTopicsProps {
  chosen: readonly string[];
  saving: boolean;
  onContinue: (chosen: string[]) => void;
}

const isStarter = (name: string) => STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name));

// Design 46d: the brief's 27 topics as chips, names only, with anything else typed in first.
// Nothing is made until Continue, so pressing a chip off again leaves nothing behind
// (docs/features/onboarding.md, "Starter topics").
export function OnboardingTopics({ chosen: initiallyChosen, saving, onContinue }: OnboardingTopicsProps) {
  const [chosen, setChosen] = useState<string[]>([...initiallyChosen]);
  const [typing, setTyping] = useState("");
  const fieldId = useId();
  const typed = chosen.filter((name) => !isStarter(name));
  const has = (name: string) => chosen.some((held) => sameTopicName(held, name));
  const toggle = (name: string) =>
    setChosen((current) => (has(name) ? current.filter((held) => !sameTopicName(held, name)) : [...current, name]));

  const pick = (event: FormEvent) => {
    event.preventDefault();
    const name = typing.trim();
    if (name === "") return;
    if (!has(name)) setChosen((current) => [...current, name]);
    setTyping("");
  };

  return (
    <div className={styles.root} data-testid={onboardingTopicsTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>What are you curious about?</OnboardingHeading>
        <p className={styles.lead}>
          Choose the topics that interest you and we'll sort matching overviews into them. You can add or remove topics
          any time.
        </p>
      </div>

      <form className={styles.typed} onSubmit={pick}>
        <label htmlFor={fieldId} className={styles.label}>
          Something else? Type it
        </label>
        <span className={styles.field}>
          <input
            id={fieldId}
            className={styles.input}
            placeholder="Type a topic"
            value={typing}
            maxLength={60}
            onChange={(event) => setTyping(event.target.value)}
            data-testid={onboardingTopicsTestIds.typeField}
          />
          <button type="submit" className={styles.pick} disabled={typing.trim() === ""} data-testid={onboardingTopicsTestIds.pick}>
            Pick
          </button>
        </span>
      </form>

      <div className={styles.chips} role="group" aria-label="Topics">
        {[...typed, ...STARTER_TOPICS.map((topic) => topic.name)].map((name) => (
          <button
            key={name}
            type="button"
            className={styles.chip}
            aria-pressed={has(name)}
            onClick={() => toggle(name)}
            data-testid={onboardingTopicsTestIds.chip(name)}
          >
            {has(name) && <StrokeIcon name="check" size={14} />}
            {name}
          </button>
        ))}
      </div>

      <div className={styles.foot}>
        <p className={styles.count} aria-live="polite" data-testid={onboardingTopicsTestIds.count}>
          {chosen.length > 0 ? (
            <strong>{chosen.length} picked</strong>
          ) : (
            "No topics yet? That's fine. New overviews will wait in Unsorted until you sort them."
          )}
        </p>
        <button
          type="button"
          className={styles.primary}
          disabled={saving}
          onClick={() => onContinue(chosen)}
          data-testid={onboardingTopicsTestIds.continue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

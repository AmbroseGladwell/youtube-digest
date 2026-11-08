import { useId, useRef, useState, type FormEvent } from "react";
import { sameTopicName, STARTER_TOPICS } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingTopics.module.scss";
import { onboardingTopicsTestIds } from "./OnboardingTopicsTestIds.js";

// Topics suggested from the source (OV-176, 175b): starter ones, and at most one new one.
export interface OnboardingTopicSuggestions {
  noun: string;
  names: readonly string[];
  newTopic: string | null;
  // Matched in code while the model's answer was still on its way, because it failed, or because
  // the model wasn't asked (a sample, a shared copy, no server).
  by: "model" | "code-pending" | "code-failed" | "code-only";
}

export interface OnboardingTopicsProps {
  chosen: readonly string[];
  suggestions: OnboardingTopicSuggestions | null;
  saving: boolean;
  // Each press, so the preview shows picks as they land (175b); nothing is made until Continue.
  onChange: (chosen: string[]) => void;
  onContinue: (chosen: string[]) => void;
}

const isStarter = (name: string) => STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name));

// Design 46d: the brief's 27 topics as chips, names only, with anything else typed in first.
// Nothing is made until Continue, so pressing a chip off again leaves nothing behind
// (docs/features/onboarding.md, "Starter topics").
export function OnboardingTopics({ chosen: initiallyChosen, suggestions, saving, onChange, onContinue }: OnboardingTopicsProps) {
  const [chosen, setChosenHere] = useState<string[]>([...initiallyChosen]);
  const setChosen = (change: (current: string[]) => string[]) => {
    const next = change(chosen);
    setChosenHere(next);
    onChange(next);
  };
  const [typing, setTyping] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const suggestedId = useId();
  const suggested = [...(suggestions?.names ?? []), ...(suggestions?.newTopic ? [suggestions.newTopic] : [])];
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
    field.current?.focus();
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

      {suggestions !== null && suggested.length > 0 && (
        <div className={styles.group} role="group" aria-labelledby={suggestedId} data-testid={onboardingTopicsTestIds.suggested}>
          <p id={suggestedId} className={styles.groupLabel}>
            For this {suggestions.noun}
            <span className={styles.from}> · suggested from what it's about</span>
          </p>
          <div className={styles.chips}>
            {suggested.map((name) => {
              const isNew = name === suggestions.newTopic;
              return (
                <button
                  key={name}
                  type="button"
                  className={styles.chip}
                  aria-pressed={has(name)}
                  aria-label={isNew ? `${name}, new topic` : undefined}
                  onClick={() => toggle(name)}
                  data-testid={onboardingTopicsTestIds.suggestion(name)}
                >
                  {has(name) && <StrokeIcon name="check" size={14} />}
                  {name}
                  {isNew && (
                    <span className={styles.newTag} aria-hidden="true">
                      New
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form className={styles.typed} onSubmit={pick}>
        <label htmlFor={fieldId} className={styles.label}>
          Something else? Type it
        </label>
        <span className={styles.field}>
          <input
            ref={field}
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

      <div className={styles.group}>
        {suggested.length > 0 && (
          <p className={styles.groupLabel} aria-hidden="true">
            All topics
          </p>
        )}
        <div className={styles.chips} role="group" aria-label="All topics">
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
      </div>

      <p className={styles.count} aria-live="polite" data-testid={onboardingTopicsTestIds.count}>
        {chosen.length > 0 ? (
          <strong>{chosen.length} picked</strong>
        ) : (
          "No topics yet? That's fine. New overviews will wait in Unsorted until you sort them."
        )}
      </p>

      <div className={styles.foot}>
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

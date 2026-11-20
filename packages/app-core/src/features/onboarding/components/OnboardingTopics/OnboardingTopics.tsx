import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  // Under the chips on a narrow screen: the topics-and-projects card the wide pane shows (327f-p).
  below?: ReactNode;
  onContinue: (chosen: string[]) => void;
}

// "Popular" (327e), Finance for the design's Money; the rest of the 27 open in place.
const POPULAR = ["Business", "Tech", "Travel", "Finance", "Science", "Design", "Food", "Career"];
const POPULAR_SHOWN = 8;

const isStarter = (name: string) => STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name));

// Design 327e: up to three suggested for this source, pre-ticked, eight popular, and the rest of the
// 27 on See all, with anything else typed in there. Nothing is made until Continue, so pressing a
// chip off again leaves nothing behind (docs/features/onboarding.md, "Starter topics").
export function OnboardingTopics({ chosen: initiallyChosen, suggestions, saving, below, onContinue }: OnboardingTopicsProps) {
  const [chosen, setChosenHere] = useState<string[]>([...initiallyChosen]);
  const [touched, setTouched] = useState(initiallyChosen.length > 0);
  const [allShown, setAllShown] = useState(false);
  const setChosen = (change: (current: string[]) => string[]) => {
    setTouched(true);
    setChosenHere(change);
  };
  const [typing, setTyping] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const suggestedId = useId();
  const suggested = [...(suggestions?.names ?? []), ...(suggestions?.newTopic ? [suggestions.newTopic] : [])];
  const suggestedKey = suggested.join("\u0000");
  useEffect(() => {
    if (!touched && suggestedKey !== "") setChosenHere(suggestedKey.split("\u0000"));
  }, [touched, suggestedKey]);
  const isSuggested = (name: string) => suggested.some((offered) => sameTopicName(offered, name));
  const popular = [...POPULAR, ...STARTER_TOPICS.map((topic) => topic.name)]
    .filter((name, index, all) => !isSuggested(name) && all.findIndex((other) => sameTopicName(other, name)) === index)
    .slice(0, POPULAR_SHOWN);
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
        <OnboardingHeading>It joins a library built around what you care about.</OnboardingHeading>
        <p className={styles.lead}>Pick what you want to keep up with. Overviews sort themselves as they’re written.</p>
      </div>

      {suggestions !== null && suggested.length > 0 && (
        <div className={styles.group} role="group" aria-labelledby={suggestedId} data-testid={onboardingTopicsTestIds.suggested}>
          <p id={suggestedId} className={styles.groupLabel}>
            For this {suggestions.noun}
            <span className={styles.from}> · from its title and description</span>
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

      {allShown ? (
        <>
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
            <p className={styles.groupLabel} aria-hidden="true">
              All topics
            </p>
            <div className={styles.chips} role="group" aria-label="All topics">
              {[...typed, ...STARTER_TOPICS.map((topic) => topic.name)].map((name) => (
                <TopicChip key={name} name={name} pressed={has(name)} onToggle={toggle} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.group}>
          <p className={styles.groupLabel} aria-hidden="true">
            Popular
          </p>
          <div className={styles.chips} role="group" aria-label="Popular topics">
            {[...typed, ...popular].map((name) => (
              <TopicChip key={name} name={name} pressed={has(name)} onToggle={toggle} />
            ))}
            <button type="button" className={styles.seeAll} onClick={() => setAllShown(true)} data-testid={onboardingTopicsTestIds.seeAll}>
              See all {STARTER_TOPICS.length} topics
            </button>
          </div>
        </div>
      )}

      {below}

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

function TopicChip({ name, pressed, onToggle }: { name: string; pressed: boolean; onToggle: (name: string) => void }) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      onClick={() => onToggle(name)}
      data-testid={onboardingTopicsTestIds.chip(name)}
    >
      {pressed && <StrokeIcon name="check" size={14} />}
      {name}
    </button>
  );
}

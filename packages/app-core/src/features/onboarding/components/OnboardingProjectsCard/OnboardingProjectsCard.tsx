import { useId } from "react";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OnboardingProjectsCard.module.scss";
import { onboardingProjectsCardTestIds } from "./OnboardingProjectsCardTestIds.js";

const LABEL = "Topics and projects";
const TITLE = "Topics sort everything. Projects gather it for a goal.";
const BODY = "Tags, topics and projects all keep themselves organised, so you can easily find the content you care about.";
const PROJECT_NAME = "Training for a marathon";
const PROJECT_COUNT = "14 overviews";
const PROJECT_PURPOSE = "“Getting round my first marathon in April”";
const PROJECT_ITEMS: readonly { icon: StrokeIconName; title: string; from: string }[] = [
  { icon: "play", title: "The long run, explained", from: "Run Coach Ash · Video" },
  { icon: "fileText", title: "Fuelling a 20-mile training week", from: "Runner's Notes · Article" },
  { icon: "chefHat", title: "Overnight oats for early runs", from: "Good Food · Recipe" },
  { icon: "headphones", title: "Pacing your first marathon", from: "The Running Pod · Podcast" },
];
const GATHERS_FROM = "Gathers from";
const PROJECT_TOPICS = ["Fitness", "Health", "Food"];

export interface OnboardingProjectsCardProps {
  compact?: boolean;
}

export function OnboardingProjectsCard({ compact = false }: OnboardingProjectsCardProps) {
  const labelId = useId();
  const project = (
    <div className={compact ? styles.projectCompact : styles.project} data-testid={onboardingProjectsCardTestIds.project}>
      <span className={styles.projectHead}>
        <span className={styles.projectName}>
          <StrokeIcon name="folder" size={15} />
          {PROJECT_NAME}
        </span>
        <span className={styles.muted}>{PROJECT_COUNT}</span>
      </span>
      <span className={styles.purpose}>{PROJECT_PURPOSE}</span>
      {!compact && (
        <ul className={styles.items}>
          {PROJECT_ITEMS.map((item) => (
            <li key={item.title} className={styles.item}>
              <span className={styles.tile}>
                <StrokeIcon name={item.icon} size={11} />
              </span>
              <span className={styles.itemText}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemFrom}>{item.from}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.gathers}>
        <span className={styles.gathersLabel}>{GATHERS_FROM}</span>
        {PROJECT_TOPICS.map((topic) => (
          <span key={topic} className={styles.topic}>
            {topic}
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <aside
      className={compact ? styles.rootCompact : styles.root}
      aria-labelledby={labelId}
      data-testid={onboardingProjectsCardTestIds.root}
    >
      <h2 id={labelId} className={styles.label}>
        {LABEL}
      </h2>
      <p className={styles.title}>{TITLE}</p>
      <p className={styles.body}>{BODY}</p>
      {compact ? project : <div className={styles.scene}>{project}</div>}
    </aside>
  );
}

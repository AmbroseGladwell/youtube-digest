import type { ReactNode } from "react";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./SelectionBar.module.scss";
import { selectionBarTestIds } from "./SelectionBarTestIds.js";

export interface SelectionBarProps {
  count: number;
  // A phone's bar is icons alone, each named for a screen reader: the count is on the count
  // line already.
  iconsOnly: boolean;
  allRead: boolean;
  allFavourite: boolean;
  // On a project's page, the bar can take them out of it.
  projectName: string | null;
  onAddToProject: () => void;
  onAddToTopic: () => void;
  onToggleRead: () => void;
  onToggleFavourite: () => void;
  onRemoveFromProject: () => void;
  onDelete: () => void;
}

interface Action {
  label: string;
  icon: ReactNode;
  tone: "brand" | "plain" | "warning";
  pressed?: boolean;
  iconAlways?: boolean;
  onClick: () => void;
  testId: string;
}

const icon = (name: StrokeIconName) => <StrokeIcon name={name} size={16} />;

// Five actions, the orange one first, Delete last in warning ink ("OV-168 5" 168az, 168bb).
export function SelectionBar({
  count,
  iconsOnly,
  allRead,
  allFavourite,
  projectName,
  onAddToProject,
  onAddToTopic,
  onToggleRead,
  onToggleFavourite,
  onRemoveFromProject,
  onDelete,
}: SelectionBarProps) {
  const actions: Action[] = [
    {
      label: "Add to project…",
      icon: icon("folder"),
      tone: "brand",
      onClick: onAddToProject,
      testId: selectionBarTestIds.addToProjectButton,
    },
    { label: "Add to topic…", icon: icon("tag"), tone: "plain", onClick: onAddToTopic, testId: selectionBarTestIds.addToTopicButton },
    {
      label: allRead ? "Mark unread" : "Mark read",
      icon: icon("checkCheck"),
      tone: "plain",
      onClick: onToggleRead,
      testId: selectionBarTestIds.readButton,
    },
    {
      label: "Favourite",
      icon: <FavouriteIcon filled={allFavourite} />,
      tone: "plain",
      pressed: allFavourite,
      iconAlways: true,
      onClick: onToggleFavourite,
      testId: selectionBarTestIds.favouriteButton,
    },
    ...(projectName === null
      ? []
      : [
          {
            label: `Remove from ${projectName}`,
            icon: icon("circleMinus"),
            tone: "plain" as const,
            onClick: onRemoveFromProject,
            testId: selectionBarTestIds.removeFromProjectButton,
          },
        ]),
    { label: "Delete…", icon: icon("trash"), tone: "warning", onClick: onDelete, testId: selectionBarTestIds.deleteButton },
  ];
  const label = `${count} selected`;

  return (
    <div className={styles.dock}>
      <div
        className={`${styles.bar} ${iconsOnly ? styles.iconsOnly : ""}`}
        role="toolbar"
        aria-label={label}
        data-testid={selectionBarTestIds.root}
      >
        {!iconsOnly && (
          <span className={styles.count} data-testid={selectionBarTestIds.count}>
            {label}
          </span>
        )}
        {actions.map((action) => {
          const bare = iconsOnly || action.iconAlways === true;
          return (
            <button
              key={action.testId}
              type="button"
              className={`${styles.action} ${styles[action.tone]} ${bare ? styles.bare : ""}`}
              onClick={action.onClick}
              disabled={count === 0}
              aria-pressed={action.pressed}
              aria-label={bare ? action.label.replace("…", "") : undefined}
              title={bare ? action.label.replace("…", "") : undefined}
              data-testid={action.testId}
            >
              {bare ? action.icon : action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

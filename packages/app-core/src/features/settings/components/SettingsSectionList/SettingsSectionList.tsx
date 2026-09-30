import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { SettingsSectionId } from "../../SettingsSectionId.js";
import type { SettingsSectionSummary } from "../../useSettingsSections.js";
import styles from "./SettingsSectionList.module.scss";
import { settingsSectionListTestIds } from "./SettingsSectionListTestIds.js";

export interface SettingsSectionListProps {
  sections: SettingsSectionSummary[];
  current: SettingsSectionId | null;
  stacked: boolean;
}

// Design OV-51 51a and 51d: each row carries its section's current value, so most visits
// end here.
export function SettingsSectionList({ sections, current, stacked }: SettingsSectionListProps) {
  return (
    <nav
      className={stacked ? styles.stacked : styles.beside}
      aria-label="Settings sections"
      data-testid={settingsSectionListTestIds.root}
    >
      {sections.map((section) => (
        <Link
          key={section.id}
          className={styles.row}
          to={Routes.settingsSection(section.id)}
          aria-current={section.id === current ? "page" : undefined}
          data-testid={settingsSectionListTestIds.row(section.id)}
        >
          <span className={styles.names}>
            <span className={styles.title}>{section.title}</span>
            <span className={styles.value} data-testid={settingsSectionListTestIds.rowValue(section.id)}>
              {section.value}
            </span>
          </span>
          {stacked && (
            <span className={styles.chevron}>
              <StrokeIcon name="chevronRight" size={18} />
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

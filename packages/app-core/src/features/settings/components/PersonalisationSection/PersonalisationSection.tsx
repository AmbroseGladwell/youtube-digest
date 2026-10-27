import { useId } from "react";
import { DEFAULT_SECTIONS_ENABLED, type SectionsEnabled } from "@overview/domain";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { OVERVIEW_SECTIONS } from "../../util/overviewSections.js";
import styles from "./PersonalisationSection.module.scss";
import { personalisationSectionTestIds } from "./PersonalisationSectionTestIds.js";

export const PERSONALISATION_STANDFIRST =
  "Which parts your next overviews include. Overviews you already have keep theirs.";

function SectionSwitch({
  section,
  label,
  hint,
  on,
  onSwitch,
}: {
  section: keyof SectionsEnabled;
  label: string;
  hint: string;
  on: boolean;
  onSwitch: () => void;
}) {
  const labelId = useId();
  const hintId = useId();

  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel} id={labelId}>
          {label}
        </span>
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        onClick={onSwitch}
        data-testid={personalisationSectionTestIds.switch(section)}
      >
        <span className={styles.knob} />
      </button>
    </div>
  );
}

// docs/features/personalisation.md.
export function PersonalisationSection() {
  const sectionsEnabled = useSettingsQuery().data?.sectionsEnabled ?? DEFAULT_SECTIONS_ENABLED;
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();

  const switchSection = (section: keyof SectionsEnabled) => {
    const on = !sectionsEnabled[section];
    analytics.settings.personalisation.sectionSwitched({ section, on });
    updateSettings.mutate({ sectionsEnabled: { ...sectionsEnabled, [section]: on } });
  };

  return (
    <div className={styles.card} data-testid={personalisationSectionTestIds.root}>
      {OVERVIEW_SECTIONS.map(({ section, label, hint }) => (
        <SectionSwitch
          key={section}
          section={section}
          label={label}
          hint={hint}
          on={sectionsEnabled[section]}
          onSwitch={() => switchSection(section)}
        />
      ))}
    </div>
  );
}

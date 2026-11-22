import { useId } from "react";
import { DEFAULT_SECTIONS_ENABLED, DEFAULT_SETTINGS, type SectionsEnabled } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { OVERVIEW_SECTIONS } from "../../util/overviewSections.js";
import { WhatWeKnowCard } from "../WhatWeKnowCard/WhatWeKnowCard.js";
import styles from "./PersonalisationSection.module.scss";
import { personalisationSectionTestIds } from "./PersonalisationSectionTestIds.js";

export const PERSONALISATION_STANDFIRST =
  "Turns each overview's How to apply into steps that fit your life. Overviews you already have stay as they are.";

interface SettingSwitchProps {
  testId: string;
  label: string;
  hint: string;
  on: boolean;
  onSwitch: () => void;
}

const SettingSwitch = ({ testId, label, hint, on, onSwitch }: SettingSwitchProps) => {
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
        data-testid={testId}
      >
        <span className={styles.knob} />
      </button>
    </div>
  );
};

// What we know about you, the sections an overview can leave out, then filing into projects (design 141k;
// docs/features/personalisation.md).
export const PersonalisationSection = () => {
  const settings = useSettingsQuery().data;
  const sectionsEnabled = settings?.sectionsEnabled ?? DEFAULT_SECTIONS_ENABLED;
  const fileIntoProjects = settings?.fileIntoProjects ?? DEFAULT_SETTINGS.fileIntoProjects;
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();

  const switchSection = (section: keyof SectionsEnabled) => {
    const on = !sectionsEnabled[section];
    analytics.settings.personalisation.sectionSwitched({ section, on });
    updateSettings.mutate({ sectionsEnabled: { ...sectionsEnabled, [section]: on } });
  };

  const switchFiling = () => {
    const on = !fileIntoProjects;
    analytics.settings.personalisation.projectFilingSwitched({ on });
    updateSettings.mutate({ fileIntoProjects: on });
  };

  return (
    <div className={styles.root}>
      <WhatWeKnowCard />
      <div className={styles.card} data-testid={personalisationSectionTestIds.root}>
        <span className={styles.cardTitle}>Sections</span>
        {OVERVIEW_SECTIONS.map(({ section, label, hint }) => (
          <SettingSwitch
            key={section}
            testId={personalisationSectionTestIds.switch(section)}
            label={label}
            hint={hint}
            on={sectionsEnabled[section]}
            onSwitch={() => switchSection(section)}
          />
        ))}
        {!sectionsEnabled.steps && (
          <p className={styles.note} data-testid={personalisationSectionTestIds.stepsOffNote}>
            The steps are hidden on every overview, and new overviews are written without them. Turn it back on to see them on overviews
            that have them.
          </p>
        )}
        {!sectionsEnabled.resources && (
          <p className={styles.note} data-testid={personalisationSectionTestIds.resourcesOffNote}>
            Resources are hidden on every overview. They’re still kept, so turning this back on shows them again.
          </p>
        )}
        {sectionsEnabled.followUpQuestions && (
          <p className={styles.note} data-testid={personalisationSectionTestIds.followUpAssistantNote}>
            Questions open in the assistant you choose in{" "}
            <PageLink
              to={Routes.settingsSection("connections")}
              className={styles.jump}
              data-testid={personalisationSectionTestIds.connectionsLink}
            >
              Connections
            </PageLink>
            .
          </p>
        )}
        {!sectionsEnabled.followUpQuestions && (
          <p className={styles.note} data-testid={personalisationSectionTestIds.followUpQuestionsOffNote}>
            Questions are hidden on every overview. They’re still written, so turning this back on shows them again.
          </p>
        )}
      </div>
      <div className={styles.card} data-testid={personalisationSectionTestIds.projectFilingCard}>
        <span className={styles.cardTitle}>Projects</span>
        <SettingSwitch
          testId={personalisationSectionTestIds.projectFilingSwitch}
          label="File new overviews into projects"
          hint="Puts each new overview into any of your projects it clearly helps with. You can take one out, and it stays out."
          on={fileIntoProjects}
          onSwitch={switchFiling}
        />
      </div>
    </div>
  );
};

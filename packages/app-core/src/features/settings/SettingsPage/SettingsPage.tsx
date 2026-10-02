import { Link } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { BYO_KEY_NOTE } from "../../apiKeys/byoKeyNote.js";
import { ConnectionsSection } from "../../connections/components/ConnectionsSection/ConnectionsSection.js";
import { PlusPlanPanel } from "../../plus/components/PlusPlanPanel/PlusPlanPanel.js";
import {
  SHARED_LINKS_STANDFIRST,
  SharedLinksPanel,
} from "../../shares/components/SharedLinksPanel/SharedLinksPanel.js";
import { SyncPanel } from "../../sync/components/SyncPanel/SyncPanel.js";
import {
  MILESTONES_STANDFIRST,
  MilestonesSection,
} from "../../timeSaved/components/MilestonesSection/MilestonesSection.js";
import { ApiKeysSection } from "../components/ApiKeysSection/ApiKeysSection.js";
import { BuildLine } from "../components/BuildLine/BuildLine.js";
import {
  NARRATION_VOICE_STANDFIRST,
  NarrationVoicePicker,
} from "../components/NarrationVoicePicker/NarrationVoicePicker.js";
import { SettingsSection, settingsSectionHeadingId } from "../components/SettingsSection/SettingsSection.js";
import { SettingsSectionList } from "../components/SettingsSectionList/SettingsSectionList.js";
import type { SettingsSectionId } from "../SettingsSectionId.js";
import { useSettingsSections, type SettingsSectionSummary } from "../useSettingsSections.js";
import styles from "./SettingsPage.module.scss";
import { settingsPageTestIds } from "./SettingsPageTestIds.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";

export interface SettingsPageProps {
  section?: SettingsSectionId;
}

const INTROS: Record<SettingsSectionId, string | null> = {
  account: "Who is signed in, and whether this device is in step.",
  voice: NARRATION_VOICE_STANDFIRST,
  keys: BYO_KEY_NOTE,
  connections: null,
  milestones: MILESTONES_STANDFIRST,
  shared: SHARED_LINKS_STANDFIRST,
  plan: null,
  about: null,
};

function SectionBody({ id }: { id: SettingsSectionId }) {
  switch (id) {
    case "account":
      return <SyncPanel />;
    case "voice":
      return <NarrationVoicePicker scrollToChosen labelledBy={settingsSectionHeadingId("voice")} />;
    case "keys":
      return <ApiKeysSection />;
    case "connections":
      return <ConnectionsSection />;
    case "milestones":
      return <MilestonesSection />;
    case "shared":
      return <SharedLinksPanel />;
    case "plan":
      return <PlusPlanPanel />;
    case "about":
      return <BuildLine />;
  }
}

// Design OV-51 (docs/features/settings.md): two panes on a wide screen, and on a phone or in
// the panel the list is the page and each section is a page of its own.
export function SettingsPage({ section }: SettingsPageProps) {
  const analytics = useAnalytics();
  const sections = useSettingsSections();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const stacked = isPanel || isPhone;
  const requested = sections.find((summary) => summary.id === section);
  const current = requested ?? (stacked ? undefined : sections[0]);

  const renderSection = (summary: SettingsSectionSummary) => (
    <SettingsSection
      key={summary.id}
      id={summary.id}
      title={summary.title}
      intro={INTROS[summary.id]}
      focusOnArrival={requested !== undefined}
    >
      <SectionBody id={summary.id} />
    </SettingsSection>
  );

  if (stacked && current !== undefined) {
    return (
      <div className={`${styles.root} ${styles.rootStacked}`} data-testid={settingsPageTestIds.root}>
        <div className={styles.back}>
          <Link
            className={styles.backLink}
            to={Routes.settings()}
            onClick={() => analytics.settings.page.backToSettingsChosen()}
            data-testid={settingsPageTestIds.settingsLink}
          >
            <StrokeIcon name="arrowLeft" /> Settings
          </Link>
        </div>
        {renderSection(current)}
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${stacked ? styles.rootStacked : ""}`} data-testid={settingsPageTestIds.root}>
      <Link
        className={styles.backLink}
        to={Routes.home()}
        onClick={() => analytics.settings.page.overviewsChosen()}
        data-testid={settingsPageTestIds.overviewsLink}
      >
        <StrokeIcon name="arrowLeft" /> {isPanel ? "Back" : "All overviews"}
      </Link>
      <h1 className={styles.title}>Settings</h1>
      {stacked ? (
        <SettingsSectionList sections={sections} current={null} stacked />
      ) : (
        <div className={styles.panes}>
          <SettingsSectionList sections={sections} current={current?.id ?? null} stacked={false} />
          {current !== undefined && renderSection(current)}
        </div>
      )}
    </div>
  );
}

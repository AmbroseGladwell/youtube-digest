import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { useBackTo } from "../../../app/useBackTo.js";
import { useLentBackLink } from "../../../app/useLentBackLink.js";
import { useHomeName } from "../../../app/useHomeName.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { APPEARANCE_STANDFIRST, AppearanceSection } from "../../appearance/components/AppearanceSection/AppearanceSection.js";
import { ConnectionsSection } from "../../connections/components/ConnectionsSection/ConnectionsSection.js";
import { PlaylistsSection } from "../../playlists/components/PlaylistsSection/PlaylistsSection.js";
import { PlusPlanPanel } from "../../plus/components/PlusPlanPanel/PlusPlanPanel.js";
import { SHARED_LINKS_STANDFIRST, SharedLinksPanel } from "../../shares/components/SharedLinksPanel/SharedLinksPanel.js";
import { SyncPanel } from "../../sync/components/SyncPanel/SyncPanel.js";
import { MILESTONES_STANDFIRST, MilestonesSection } from "../../timeSaved/components/MilestonesSection/MilestonesSection.js";
import { ApiKeysSection } from "../components/ApiKeysSection/ApiKeysSection.js";
import { BuildLine } from "../components/BuildLine/BuildLine.js";
import { NARRATION_VOICE_STANDFIRST, NarrationVoicePicker } from "../components/NarrationVoicePicker/NarrationVoicePicker.js";
import { PERSONALISATION_STANDFIRST, PersonalisationSection } from "../components/PersonalisationSection/PersonalisationSection.js";
import { COOKING_STANDFIRST, TimerSoundPicker } from "../components/TimerSoundPicker/TimerSoundPicker.js";
import { SettingsSection, settingsSectionHeadingId } from "../components/SettingsSection/SettingsSection.js";
import { SettingsSectionList } from "../components/SettingsSectionList/SettingsSectionList.js";
import type { SettingsSectionId } from "../SettingsSectionId.js";
import { useSettingsSections, type SettingsSectionSummary } from "../useSettingsSections.js";
import { PrivacySection } from "../../analyticsConsent/components/PrivacySection/PrivacySection.js";
import { PolicyLinks } from "../components/PolicyLinks/PolicyLinks.js";
import styles from "./SettingsPage.module.scss";
import { settingsPageTestIds } from "./SettingsPageTestIds.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";

export interface SettingsPageProps {
  section?: SettingsSectionId;
}

const INTROS: Record<SettingsSectionId, string | null> = {
  account: "Who is signed in, and whether this device is in step.",
  voice: NARRATION_VOICE_STANDFIRST,
  cooking: COOKING_STANDFIRST,
  personalisation: PERSONALISATION_STANDFIRST,
  appearance: APPEARANCE_STANDFIRST,
  // Design 110a moves the standing note to the foot of the panel, so the list and the
  // choice land above the fold in the 400x600 panel.
  keys: null,
  connections: null,
  playlists: null,
  milestones: MILESTONES_STANDFIRST,
  shared: SHARED_LINKS_STANDFIRST,
  plan: null,
  privacy: null,
  about: null,
};

function SectionBody({ id }: { id: SettingsSectionId }) {
  switch (id) {
    case "account":
      return <SyncPanel />;
    case "voice":
      return <NarrationVoicePicker scrollToChosen labelledBy={settingsSectionHeadingId("voice")} />;
    case "cooking":
      return <TimerSoundPicker />;
    case "personalisation":
      return <PersonalisationSection />;
    case "appearance":
      return <AppearanceSection />;
    case "keys":
      return <ApiKeysSection />;
    case "connections":
      return <ConnectionsSection />;
    case "playlists":
      return <PlaylistsSection />;
    case "milestones":
      return <MilestonesSection />;
    case "shared":
      return <SharedLinksPanel />;
    case "plan":
      return <PlusPlanPanel />;
    case "privacy":
      return <PrivacySection />;
    case "about":
      return (
        <>
          <BuildLine />
          <PolicyLinks />
        </>
      );
  }
}

// Design OV-51 (docs/features/settings.md): two panes on a wide screen, and on a phone or in
// the panel the list is the page and each section is a page of its own.
export function SettingsPage({ section }: SettingsPageProps) {
  const analytics = useAnalytics();
  const sections = useSettingsSections();
  const isPanel = useIsPanel();
  const homeName = useHomeName();
  const isPhone = useIsPhone();
  const stacked = isPanel || isPhone;
  const requested = sections.find((summary) => summary.id === section);
  const current = requested ?? (stacked ? undefined : sections[0]);
  const sectionPage = stacked && current !== undefined;
  const backToSettings = useBackTo(Routes.settings());
  const backToOverviews = useBackTo(Routes.home());
  const backLink = useLentBackLink({
    to: sectionPage ? Routes.settings() : Routes.home(),
    label: sectionPage ? "Settings" : isPanel ? homeName : "All overviews",
    // In the panel the page draws no link of its own, so the bar holds it throughout
    // (design 205d-2).
    inPage: !isPanel,
    follow: (event) => {
      if (sectionPage) {
        analytics.settings.page.backToSettingsChosen({ from: "bar" });
        backToSettings(event);
      } else {
        analytics.settings.page.overviewsChosen({ from: "bar" });
        backToOverviews(event);
      }
    },
  });

  const renderSection = (summary: SettingsSectionSummary) => (
    <SettingsSection
      key={summary.id}
      id={summary.id}
      title={summary.title}
      intro={isPanel && summary.id === "appearance" ? null : INTROS[summary.id]}
      focusOnArrival={requested !== undefined}
    >
      <SectionBody id={summary.id} />
    </SettingsSection>
  );

  if (sectionPage) {
    return (
      <div className={`${styles.root} ${styles.rootStacked}`} data-testid={settingsPageTestIds.root}>
        {!isPanel && (
          <PageLink
            ref={backLink}
            className={styles.backLink}
            to={Routes.settings()}
            onClick={(event) => {
              analytics.settings.page.backToSettingsChosen({ from: "head" });
              backToSettings(event);
            }}
            data-testid={settingsPageTestIds.settingsLink}
          >
            <StrokeIcon name="arrowLeft" /> Settings
          </PageLink>
        )}
        {renderSection(current)}
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${stacked ? styles.rootStacked : ""}`} data-testid={settingsPageTestIds.root}>
      {!isPanel && (
        <PageLink
          ref={backLink}
          className={styles.backLink}
          to={Routes.home()}
          onClick={(event) => {
            analytics.settings.page.overviewsChosen({ from: "head" });
            backToOverviews(event);
          }}
          data-testid={settingsPageTestIds.overviewsLink}
        >
          <StrokeIcon name="arrowLeft" /> All overviews
        </PageLink>
      )}
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

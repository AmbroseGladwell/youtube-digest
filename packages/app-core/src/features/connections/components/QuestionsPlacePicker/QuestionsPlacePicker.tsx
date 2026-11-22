import { FOLLOW_UP_ASSISTANTS } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { ChoicePicker } from "../../../playlists/components/ChoicePicker/ChoicePicker.js";
import { HERE_DETAIL } from "../../../reader/components/FollowUpAssistantMenu/FollowUpAssistantMenu.js";
import { useFollowUpAssistant } from "../../../reader/useFollowUpAssistant.js";
import { useUpdateSettingsMutation } from "../../../settings/mutations/useUpdateSettingsMutation.js";
import styles from "./QuestionsPlacePicker.module.scss";
import { questionsPlacePickerTestIds } from "./QuestionsPlacePickerTestIds.js";

type Place = "here" | "assistant";
const PLACES: readonly Place[] = ["here", "assistant"];

export const QuestionsPlacePicker = () => {
  const { assistant, answeredHere } = useFollowUpAssistant();
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const name = assistant === null ? "your assistant" : FOLLOW_UP_ASSISTANTS[assistant].name;

  return (
    <div className={styles.root} data-testid={questionsPlacePickerTestIds.root}>
      <p className={styles.label}>Questions to ask next</p>
      <ChoicePicker
        choice={answeredHere ? "here" : "assistant"}
        choices={PLACES}
        labelOf={(place) => (place === "here" ? "Answered here" : `Open in ${name}`)}
        optionDetail={(place) => (place === "here" ? HERE_DETAIL : "With this note, in a new tab")}
        name="questionsPlace"
        title="Questions to ask next"
        subject="every overview"
        icon="chat"
        asSheet={isPhone && !isPanel}
        sheetFoot="Remembered on every overview. The box under the questions always asks here."
        stacked={false}
        onChange={(place) => {
          analytics.mcp.settingsConnections.questionsPlaceChosen({ here: place === "here" });
          updateSettings.mutate({ questionsAnsweredHere: place === "here" });
        }}
      />
    </div>
  );
};

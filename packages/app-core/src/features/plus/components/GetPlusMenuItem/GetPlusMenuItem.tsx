import { chatAllowances, overviewQuotas, transcriptionHours, type Plan } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { GET_OVERVIEW_PLUS, PLUS_ON_US_LINE } from "../GetPlusButton/GetPlusButton.js";
import { usePlanPrompt } from "../../usePlanPrompt.js";
import type { OnUsSpent } from "../../util/planPromptFor.js";
import styles from "./GetPlusMenuItem.module.scss";
import { getPlusMenuItemTestIds } from "./GetPlusMenuItemTestIds.js";

const count = (value: number) => value.toLocaleString("en-GB");

// What ran out, for a BYO Plus reader, and what Plus has instead (design 351b).
export const spentLineOf = (spent: OnUsSpent, plan: Plan): string => {
  switch (spent) {
    case "overviews":
      return `Your ${overviewQuotas[plan].ours} on us are used. Plus has ${overviewQuotas.plus.ours} a month`;
    case "hours":
      return `Your ${transcriptionHours[plan]} hours of transcribing are used. Plus has ${transcriptionHours.plus} a month`;
    case "questions":
      return `Your questions this month are used. Plus has about ${count(chatAllowances.plus)} a month`;
  }
};

export interface GetPlusMenuItemProps {
  onChoose: () => void;
}

// Heads the account menu in its own group; mounted only while the menu is open, so shown means seen.
export const GetPlusMenuItem = ({ onChoose }: GetPlusMenuItemProps) => {
  const { prompt, plan, chose } = usePlanPrompt({ kind: "menu" });
  if (prompt?.variant !== "menu") {
    return null;
  }
  return (
    <>
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          chose("seePlans");
          onChoose();
        }}
        data-testid={getPlusMenuItemTestIds.item}
      >
        <StrokeIcon name="gem" size={17} weight={1.8} />
        <span className={styles.text}>
          {GET_OVERVIEW_PLUS}{" "}
          <small data-testid={getPlusMenuItemTestIds.line}>
            {prompt.spent === null ? PLUS_ON_US_LINE : spentLineOf(prompt.spent, plan)}
          </small>
        </span>
      </button>
      <div role="separator" className={styles.separator} />
    </>
  );
};

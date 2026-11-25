import { ChoiceGroup } from "../../../../components/shared/ChoiceGroup/ChoiceGroup.js";
import { YEARLY_SAVES_UP_TO, type Billing } from "../../planCards.js";
import styles from "./BillingSwitch.module.scss";

export interface BillingSwitchProps {
  billing: Billing;
  onChange: (billing: Billing) => void;
  testId?: string;
}

const CHOICES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: `Yearly · save up to ${YEARLY_SAVES_UP_TO}` },
] as const;

// Yearly first, the chosen chip in ink (design 351j).
export const BillingSwitch = ({ billing, onChange, testId }: BillingSwitchProps) => (
  <div className={styles.root}>
    <ChoiceGroup
      legend="Billing"
      name="billing"
      look="chips"
      multiple={false}
      choices={CHOICES.map((choice) => (testId === undefined ? choice : { ...choice, testId: `${testId}-${choice.value}` }))}
      chosen={[billing]}
      onChoose={(value) => onChange(value as Billing)}
    />
  </div>
);

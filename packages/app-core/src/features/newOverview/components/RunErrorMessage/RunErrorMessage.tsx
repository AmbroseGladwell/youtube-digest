import { modelLabel, PROVIDER_SHORT_LABEL } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import type { RunError } from "../../types/RunError.js";
import styles from "./RunErrorMessage.module.scss";
import type { RunErrorMessageTestIds } from "./RunErrorMessageTestIds.js";

export interface RunErrorMessageProps {
  error: RunError;
  className: string | undefined;
  testId: string;
  testIds: RunErrorMessageTestIds;
  onFollowed?: () => void;
}

export function RunErrorMessage({ error, className, testId, testIds, onFollowed }: RunErrorMessageProps) {
  if (error.kind === "message") {
    return (
      <p className={className} data-testid={testId}>
        {error.message}
      </p>
    );
  }
  return (
    <p className={className} data-testid={testId}>
      {PROVIDER_SHORT_LABEL[error.provider]} couldn’t make this overview with {modelLabel(error.provider, error.model)}.{" "}
      <PageLink to={Routes.settingsSection("keys")} className={styles.settingsLink} data-testid={testIds.settingsLink} onClick={onFollowed}>
        Pick another model in Settings
      </PageLink>{" "}
      and try again.
    </p>
  );
}

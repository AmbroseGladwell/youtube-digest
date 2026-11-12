import { modelLabel, PROVIDER_SHORT_LABEL } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import type { RunError } from "../../types/RunError.js";
import { useReaderPlace } from "../../useReaderPlace.js";
import { pastedLinkFailureCopy } from "../../util/pastedLinkFailureCopy.js";
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
  if (error.kind === "articleFetch") {
    return <ArticleFetchFailure error={error} />;
  }
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

// The read was the run's, so there is no field to try again from: only a way that leaves the
// app is offered, and a regeneration names the item that remakes it beside the article.
function ArticleFetchFailure({ error }: { error: Extract<RunError, { kind: "articleFetch" }> }) {
  const place = useReaderPlace();
  const copy = pastedLinkFailureCopy(error.failure, error.url, place);
  const after = copy.after !== null && error.regenerating ? "Then press Regenerate in the side panel." : copy.after;
  return (
    <ArticleFailureNotice
      copy={copy.href === null ? { ...copy, way: null, wayLabel: null } : copy}
      href={copy.href}
      after={after}
      onWay={() => undefined}
    />
  );
}

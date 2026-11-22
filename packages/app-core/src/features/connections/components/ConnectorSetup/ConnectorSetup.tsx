import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { ChosenAssistant, FOLLOW_UP_ASSISTANTS } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../../settings/queries/settingsQuery.js";
import { connectorSteps, type ConnectorField, type CopiedField } from "../../util/connectorSteps.js";
import styles from "./ConnectorSetup.module.scss";
import { connectorSetupTestIds } from "./ConnectorSetupTestIds.js";

export interface ConnectorSetupProps {
  ref?: Ref<HTMLParagraphElement> | undefined;
  label: string;
  address: string;
  iconUrl: string;
}

const ASSISTANTS = ChosenAssistant.options;
const COPIED_FOR_MS = 2500;

const nameOf = (assistant: ChosenAssistant): string => (assistant === "other" ? "Other" : FOLLOW_UP_ASSISTANTS[assistant].name);

export const ConnectorSetup = ({ label, address, iconUrl, ref: labelRef }: ConnectorSetupProps) => {
  const analytics = useAnalytics();
  const chosen = useSettingsQuery().data?.followUpAssistant ?? null;
  const updateSettings = useUpdateSettingsMutation();
  const [copied, setCopied] = useState<CopiedField | null>(null);
  const [said, setSaid] = useState("");
  const pills = useRef<(HTMLButtonElement | null)[]>([]);
  const canCopy = typeof navigator !== "undefined" && navigator.clipboard?.writeText !== undefined;
  const focusedAt = chosen === null ? 0 : ASSISTANTS.indexOf(chosen);

  useEffect(() => {
    if (copied === null) {
      return;
    }
    const timer = setTimeout(() => setCopied(null), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const choose = (assistant: ChosenAssistant) => {
    if (assistant === chosen) {
      return;
    }
    analytics.mcp.settingsConnections.assistantChosen({ assistant });
    updateSettings.mutate({ followUpAssistant: assistant });
    setSaid(assistant === "other" ? "Steps for any other assistant shown" : `${nameOf(assistant)} steps shown`);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = pills.current.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) {
      return;
    }
    const last = ASSISTANTS.length - 1;
    const target = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowDown: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      ArrowUp: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    pills.current[target]?.focus();
    choose(ASSISTANTS[target]!);
  };

  const copy = (field: CopiedField, value: string) => {
    if (field === "address") {
      analytics.mcp.settingsConnections.addressCopied();
    } else {
      analytics.mcp.settingsConnections.fieldCopied({ field });
    }
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopied(field);
        setSaid("Copied");
      },
      () => setCopied(null),
    );
  };

  const copyButton = (field: CopiedField, value: string, accessibleName: string) =>
    canCopy &&
    (copied === field ? (
      <span className={styles.copied} data-testid={connectorSetupTestIds.copied}>
        <StrokeIcon name="check" size={14} />
        Copied
      </span>
    ) : (
      <button
        type="button"
        className={styles.copy}
        aria-label={accessibleName}
        onClick={() => copy(field, value)}
        data-testid={field === "address" ? connectorSetupTestIds.copyButton : connectorSetupTestIds.copyField(field)}
      >
        <StrokeIcon name="copy" size={14} />
        Copy
      </button>
    ));

  const addressField = (
    <div className={styles.addressField}>
      <span className={styles.address} data-testid={connectorSetupTestIds.address}>
        {address}
      </span>
      {copyButton("address", address, "Copy connector address")}
    </div>
  );

  const fieldAction = ({ label: fieldLabel, value, action }: ConnectorField) => {
    if (action === null) {
      return <span />;
    }
    if (action.kind === "download") {
      return (
        <a
          className={styles.copy}
          href={iconUrl}
          download="the-overview-icon.png"
          aria-label="Download the icon"
          onClick={() => analytics.mcp.settingsConnections.iconDownloaded()}
          data-testid={connectorSetupTestIds.downloadIcon}
        >
          <StrokeIcon name="arrowDown" size={14} />
          Download
        </a>
      );
    }
    return copyButton(action.field, value, `Copy ${fieldLabel.toLowerCase()}`) || <span />;
  };

  const setup = chosen === null ? null : connectorSteps(chosen, address);

  return (
    <div className={styles.root} data-testid={connectorSetupTestIds.root}>
      <p className={styles.label} ref={labelRef} tabIndex={-1}>
        {label}
      </p>
      <div>
        <p className={styles.question}>Which assistant do you use?</p>
        <p className={styles.sub}>We’ll show only its steps. Questions to ask next open in it too.</p>
      </div>
      <div className={styles.pills} role="radiogroup" aria-label="Your assistant" onKeyDown={moveFocus}>
        {ASSISTANTS.map((assistant, index) => (
          <button
            key={assistant}
            type="button"
            role="radio"
            aria-checked={assistant === chosen}
            tabIndex={index === focusedAt ? 0 : -1}
            ref={(element) => {
              pills.current[index] = element;
            }}
            className={`${styles.pill} ${assistant === chosen ? styles.pillOn : ""}`}
            onClick={() => choose(assistant)}
            data-testid={connectorSetupTestIds.assistant(assistant)}
          >
            <i aria-hidden="true" />
            {nameOf(assistant)}
          </button>
        ))}
      </div>
      {setup !== null && (
        <div className={styles.setup} data-testid={connectorSetupTestIds.steps}>
          {setup.limit !== null && (
            <p className={styles.limit} data-testid={connectorSetupTestIds.limit}>
              {setup.limit}
            </p>
          )}
          {setup.lead !== null && (
            <>
              <p className={styles.lead}>{setup.lead}</p>
              {addressField}
            </>
          )}
          {setup.steps.length > 0 && (
            <ol className={styles.steps} aria-label={`Connect ${nameOf(chosen!)}`}>
              {setup.steps.map((step, index) => (
                <li key={step.text} className={styles.step} data-testid={connectorSetupTestIds.step}>
                  <span className={styles.number} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className={styles.stepBody}>
                    <span className={styles.stepText}>{step.text}</span>
                    {step.address === true && addressField}
                    {step.fields !== undefined && (
                      <dl className={styles.fields}>
                        {step.fields.map((field) => (
                          <div key={field.label} className={styles.field} data-testid={connectorSetupTestIds.field}>
                            <dt>{field.label}</dt>
                            <dd>
                              {field.value}
                              {field.note !== undefined && <small>{field.note}</small>}
                            </dd>
                            {fieldAction(field)}
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <p className={styles.said} aria-live="polite">
        {said}
      </p>
    </div>
  );
};

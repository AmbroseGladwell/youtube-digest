import { useState } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { fillProjectPrompt } from "../../util/fillProjectPrompt.js";
import styles from "./ProjectEmpty.module.scss";
import { projectEmptyTestIds } from "./ProjectEmptyTestIds.js";

export interface ProjectEmptyProps {
  name: string;
  // An assistant that can change the library: a read-only one counts as none here.
  assistantWrites: boolean;
  writerName: string | null;
  // Saved overviews that might fit sit above, so this offers the other ways to fill it.
  afterSuggestions: boolean;
  onPromptCopied: () => void;
}

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

// An empty project takes the list's place: with an assistant that can fill it, a prompt to
// give it; without, the two ways to add by hand ("OV-168 3 Adding and Making" 168aa, 168ab).
// Under suggestions, the same as the ways to go further ("OV-318 1" 318a, 318d).
export const ProjectEmpty = ({ name, assistantWrites, writerName, afterSuggestions, onPromptCopied }: ProjectEmptyProps) => {
  const [copied, setCopied] = useState(false);
  const prompt = fillProjectPrompt(name);
  const assistant = writerName ?? "your assistant";
  const capitalised = assistant.charAt(0).toUpperCase() + assistant.slice(1);
  const promptBox = (
    <div className={styles.prompt}>
      <span data-testid={projectEmptyTestIds.prompt}>“{prompt}”</span>
      {canWriteClipboard() && (
        <button
          type="button"
          className={styles.copy}
          onClick={() => {
            void navigator.clipboard.writeText(prompt);
            setCopied(true);
            onPromptCopied();
          }}
          data-testid={projectEmptyTestIds.copyPromptButton}
        >
          <StrokeIcon name={copied ? "check" : "copy"} />
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      )}
    </div>
  );
  const connect = (
    <p className={styles.text}>
      Or connect an assistant like Claude to find and add them for you.{" "}
      <PageLink className={styles.link} to={Routes.settingsSection("connections")} data-testid={projectEmptyTestIds.connectionsLink}>
        Settings › Connections
      </PageLink>
    </p>
  );

  if (afterSuggestions) {
    return (
      <div className={styles.root} data-testid={projectEmptyTestIds.root}>
        {assistantWrites ? (
          <>
            <h2 className={styles.further}>Or have {assistant} look for you</h2>
            <p className={styles.text}>{capitalised} can search your whole library and help organise it. Try asking:</p>
            {promptBox}
          </>
        ) : (
          <>
            <p className={styles.text}>Or add them yourself: Select in the library, or Add to project… on any overview.</p>
            {connect}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid={projectEmptyTestIds.root}>
      <h2 className={styles.heading}>Nothing here yet</h2>
      {assistantWrites ? (
        <>
          <p className={styles.text}>Your assistant can fill it for you. Try asking:</p>
          {promptBox}
          <p className={styles.text}>Or add them yourself with Add to project… on any overview.</p>
        </>
      ) : (
        <>
          <p className={styles.text}>To add overviews, open one, then choose Add to project… in its ⋯ menu.</p>
          {connect}
        </>
      )}
    </div>
  );
};

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECT_PURPOSE_LENGTH,
  NOVELTY_LABEL,
  projectMarkdown,
  verdictSpread,
  type Novelty,
} from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { projectLongDate, projectShortDate } from "../../util/projectDates.js";
import type { ProjectSummary } from "../../util/projectSummaries.js";
import { ProjectActionsMenu } from "../ProjectActionsMenu/ProjectActionsMenu.js";
import styles from "./ProjectHead.module.scss";
import { projectHeadTestIds } from "./ProjectHeadTestIds.js";

export interface ProjectHeadProps {
  summary: ProjectSummary;
  now: Date;
  assistantConnected: boolean;
  nudged: boolean;
  onRename: (name: string) => void;
  onPurpose: (purpose: string | null) => void;
  onArchive: (from: "menu" | "nudge") => void;
  onRestore: () => void;
  onKeep: () => void;
  onDelete: () => void;
  onCopied: () => void;
}

const SPREAD: Novelty[] = ["original", "fresh_angle", "common_knowledge"];

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

// The top of a project's page: what it's for on the stone tint (1rem, 0.8rem on a phone),
// counts from code, the verdict spread, then Copy as Markdown and ⋯
// ("OV-168 2 The Project Page" 168f–168l, 168p, 168bd–168bf).
export function ProjectHead({
  summary,
  now,
  assistantConnected,
  nudged,
  onRename,
  onPurpose,
  onArchive,
  onRestore,
  onKeep,
  onDelete,
  onCopied,
}: ProjectHeadProps) {
  const { project, items, unread, updatedAt } = summary;
  const [renaming, setRenaming] = useState(false);
  const [editingPurpose, setEditingPurpose] = useState(false);
  const [copied, setCopied] = useState(false);
  const menu = useRef<HTMLButtonElement | null>(null);
  const editButton = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<RefObject<HTMLButtonElement | null>>(menu);

  useEffect(() => {
    if (!copied) return;
    const hide = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(hide);
  }, [copied]);

  const archived = project.archivedAt !== null;
  const made =
    project.createdBy.by === "assistant"
      ? `Made by ${project.createdBy.name} · ${projectShortDate(project.createdAt, now)}`
      : `Made ${projectShortDate(project.createdAt, now)}`;
  const spread = verdictSpread(items.map((item) => item.overview));
  const finishEditing = (stop: () => void) => {
    stop();
    requestAnimationFrame(() => returnTo.current.current?.focus());
  };
  const startPurpose = (from: RefObject<HTMLButtonElement | null>) => {
    returnTo.current = from;
    setEditingPurpose(true);
  };

  return (
    <div className={styles.root} data-testid={projectHeadTestIds.root}>
      <PageLink className={styles.back} to={Routes.projects()} data-testid={projectHeadTestIds.backLink}>
        <StrokeIcon name="arrowLeft" size={15} />
        All projects
      </PageLink>
      <p className={styles.kicker} data-testid={projectHeadTestIds.kicker}>
        Project
        <span className={styles.kickerMuted} aria-hidden="true">
          ·
        </span>
        <span className={styles.kickerMuted}>{made}</span>
      </p>

      {renaming ? (
        <NameEditor
          name={project.name}
          onSave={(name) => {
            if (name !== project.name) onRename(name);
            finishEditing(() => setRenaming(false));
          }}
          onCancel={() => finishEditing(() => setRenaming(false))}
        />
      ) : (
        <h1 className={styles.name} data-testid={projectHeadTestIds.name}>
          {project.name}
        </h1>
      )}

      {archived && (
        <p className={styles.strip} data-testid={projectHeadTestIds.archivedStrip}>
          <b>Archived {projectShortDate(project.archivedAt!, now)}.</b>
          <span>
            {assistantConnected ? "Hidden from your projects and from your assistant’s list." : "Hidden from your projects."} Restore brings
            it back.
          </span>
        </p>
      )}

      {editingPurpose ? (
        <PurposeEditor
          purpose={project.purpose ?? ""}
          assistantConnected={assistantConnected}
          assistantWrote={project.purpose !== null && project.purposeBy?.by === "assistant" ? project.purposeBy.name : null}
          onSave={(purpose) => {
            if (purpose !== project.purpose) onPurpose(purpose);
            finishEditing(() => setEditingPurpose(false));
          }}
          onCancel={() => finishEditing(() => setEditingPurpose(false))}
        />
      ) : project.purpose !== null ? (
        <section className={styles.purpose} aria-label="What it’s for" data-testid={projectHeadTestIds.purpose}>
          <div className={styles.purposeHead}>
            <span className={styles.purposeLabel}>What it’s for</span>
            {assistantConnected && (
              <span className={styles.purposeHint} data-testid={projectHeadTestIds.purposeHint}>
                Your assistant works from this
              </span>
            )}
          </div>
          <p className={styles.purposeText} data-testid={projectHeadTestIds.purposeText}>
            {project.purpose}
          </p>
          <div className={styles.purposeFoot}>
            {project.purposeBy?.by === "assistant" && (
              <span data-testid={projectHeadTestIds.writtenBy}>Written by {project.purposeBy.name}</span>
            )}
            <button
              type="button"
              ref={editButton}
              className={styles.edit}
              onClick={() => startPurpose(editButton)}
              aria-label="Edit what it’s for"
              data-testid={projectHeadTestIds.editPurposeButton}
            >
              <StrokeIcon name="pencil" size={13} />
              Edit
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.invitation} aria-label="What it’s for" data-testid={projectHeadTestIds.purposeInvitation}>
          <span className={styles.purposeLabel}>What it’s for</span>
          <p className={styles.invitationText}>
            {assistantConnected
              ? "Say what you’re trying to do. Your assistant works from it, so “Redo the kitchen by March for £18k” gets answers about your kitchen, not kitchens in general."
              : "Say what you’re trying to do, like “Redo the kitchen by March for £18k”. It sits at the top of the project and of Copy as Markdown."}
          </p>
          <button
            type="button"
            ref={editButton}
            className={styles.pill}
            onClick={() => startPurpose(editButton)}
            data-testid={projectHeadTestIds.addPurposeButton}
          >
            <StrokeIcon name="plus" />
            Add what it’s for
          </button>
        </section>
      )}

      <p className={styles.facts} data-testid={projectHeadTestIds.facts}>
        <span>
          <b>{items.length}</b> {items.length === 1 ? "overview" : "overviews"}
        </span>
        <span>
          <b>{unread}</b> unread
        </span>
        <span>Updated {projectShortDate(updatedAt, now)}</span>
      </p>
      {items.length > 0 && (
        <p className={styles.spread} data-testid={projectHeadTestIds.spread}>
          {SPREAD.filter((novelty) => spread[novelty] > 0).map((novelty) => (
            <span key={novelty} className={styles.verdict}>
              {spread[novelty]} {NOVELTY_LABEL[novelty]}
            </span>
          ))}
          {spread.dubious > 0 && (
            <span className={styles.dubious}>
              <StrokeIcon name="alert" size={13} />
              {spread.dubious} dubious
            </span>
          )}
        </p>
      )}

      {nudged && (
        <div className={styles.nudge} role="status" data-testid={projectHeadTestIds.nudge}>
          <span>Nothing new since {projectLongDate(updatedAt)}. Still working on this?</span>
          <span className={styles.nudgeActions}>
            <button type="button" className={styles.pill} onClick={onKeep} data-testid={projectHeadTestIds.keepButton}>
              Keep it
            </button>
            <button
              type="button"
              className={styles.pill}
              onClick={() => onArchive("nudge")}
              data-testid={projectHeadTestIds.nudgeArchiveButton}
            >
              <StrokeIcon name="archive" />
              Archive
            </button>
          </span>
        </div>
      )}

      <div className={styles.actions}>
        {archived && (
          <button type="button" className={styles.pill} onClick={onRestore} data-testid={projectHeadTestIds.restoreButton}>
            <StrokeIcon name="archive" />
            Restore
          </button>
        )}
        {canWriteClipboard() && (
          <button
            type="button"
            className={styles.pill}
            onClick={() => {
              void navigator.clipboard.writeText(projectMarkdown(project, items));
              setCopied(true);
              onCopied();
            }}
            data-testid={projectHeadTestIds.copyButton}
          >
            <StrokeIcon name={copied ? "check" : "copy"} />
            <span aria-live="polite">{copied ? "Copied" : "Copy as Markdown"}</span>
          </button>
        )}
        <ProjectActionsMenu
          ref={menu}
          archived={archived}
          onRename={() => {
            returnTo.current = menu;
            setRenaming(true);
          }}
          onEditPurpose={() => startPurpose(menu)}
          onArchive={() => onArchive("menu")}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function NameEditor({ name, onSave, onCancel }: { name: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const field = useRef<HTMLInputElement | null>(null);
  const helpId = useId();
  useEffect(() => field.current?.select(), []);
  const trimmed = value.trim();
  const save = () => {
    if (trimmed !== "") onSave(trimmed);
  };
  return (
    <div className={styles.editor}>
      <input
        ref={field}
        name="project-name"
        autoComplete="off"
        className={styles.nameInput}
        maxLength={MAX_PROJECT_NAME_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        aria-label="Project name"
        aria-describedby={helpId}
        data-testid={projectHeadTestIds.nameInput}
      />
      <p className={styles.help} id={helpId}>
        <span>Enter saves · Escape cancels</span>
        <span className={styles.count} data-testid={projectHeadTestIds.nameCount}>
          {value.length} / {MAX_PROJECT_NAME_LENGTH}
        </span>
      </p>
      <div className={styles.editorActions}>
        <button type="button" className={styles.save} onClick={save} disabled={trimmed === ""} data-testid={projectHeadTestIds.saveButton}>
          Save
        </button>
        <button type="button" className={styles.pill} onClick={onCancel} data-testid={projectHeadTestIds.cancelButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PurposeEditor({
  purpose,
  assistantConnected,
  assistantWrote,
  onSave,
  onCancel,
}: {
  purpose: string;
  assistantConnected: boolean;
  assistantWrote: string | null;
  onSave: (purpose: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(purpose);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const helpId = useId();
  useEffect(() => field.current?.select(), []);
  const save = () => onSave(value.trim() === "" ? null : value.trim());
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };
  return (
    <section className={styles.purpose} aria-label="What it’s for" data-testid={projectHeadTestIds.purpose}>
      <div className={styles.purposeHead}>
        <span className={styles.purposeLabel}>What it’s for</span>
        {assistantConnected && <span className={styles.purposeHint}>Your assistant works from this</span>}
      </div>
      <textarea
        ref={field}
        name="project-purpose"
        className={styles.purposeInput}
        maxLength={MAX_PROJECT_PURPOSE_LENGTH}
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label="What it’s for"
        aria-describedby={helpId}
        data-testid={projectHeadTestIds.purposeInput}
      />
      <p className={styles.help} id={helpId}>
        <span data-testid={projectHeadTestIds.purposeHelp}>
          {assistantWrote === null ? "" : `Saving makes it yours: “Written by ${assistantWrote}” goes.`}
        </span>
        <span className={styles.count} data-testid={projectHeadTestIds.purposeCount}>
          {value.length} / {MAX_PROJECT_PURPOSE_LENGTH}
        </span>
      </p>
      <div className={styles.editorActions}>
        <button type="button" className={styles.save} onClick={save} data-testid={projectHeadTestIds.saveButton}>
          Save
        </button>
        <button
          type="button"
          className={`${styles.pill} ${styles.onTint}`}
          onClick={onCancel}
          data-testid={projectHeadTestIds.cancelButton}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

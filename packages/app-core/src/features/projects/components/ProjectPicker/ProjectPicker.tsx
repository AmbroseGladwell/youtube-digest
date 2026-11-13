import { useEffect, useId, useRef, useState } from "react";
import type { ProjectId } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ProjectSummary } from "../../util/projectSummaries.js";
import styles from "./ProjectPicker.module.scss";
import { projectPickerTestIds } from "./ProjectPickerTestIds.js";

export interface ProjectPickerProps {
  // Active projects, last changed first.
  summaries: ProjectSummary[];
  inProject: ReadonlySet<string>;
  onToggle: (projectId: ProjectId, inProject: boolean) => void;
  onNewProject: () => void;
  onClose: () => void;
}

const FIND_ABOVE = 8;

const footLine = (count: number): string => (count === 0 ? "Not in a project yet" : count === 1 ? "In 1 project" : `In ${count} projects`);

// A dialog on the web and a sheet on a phone. Each tick saves as it's made, and Done only
// closes ("OV-168 3 Adding and Making" 168t, 168u).
export function ProjectPicker({ summaries, inProject, onToggle, onNewProject, onClose }: ProjectPickerProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [query, setQuery] = useState("");
  const headingId = useId();
  const findId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
  }, []);

  const needle = query.trim().toLocaleLowerCase();
  const shown = needle === "" ? summaries : summaries.filter(({ project }) => project.name.toLocaleLowerCase().includes(needle));
  const count = summaries.filter(({ project }) => inProject.has(project.id)).length;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      data-testid={projectPickerTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 className={styles.heading} id={headingId}>
          Add to projects
        </h2>
        <p className={styles.hint}>Changes save as you go.</p>
        {summaries.length > FIND_ABOVE && (
          <label className={styles.find} htmlFor={findId}>
            <StrokeIcon name="search" size={14} />
            <input
              id={findId}
              name="project-find"
              type="search"
              autoComplete="off"
              className={styles.findInput}
              placeholder="Find a project"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-testid={projectPickerTestIds.findInput}
            />
          </label>
        )}
        <div className={styles.list} role="group" aria-label="Projects">
          {shown.map(({ project, items }) => {
            const checked = inProject.has(project.id);
            return (
              <label key={project.id} className={styles.option} data-testid={projectPickerTestIds.option(project.name)}>
                <input type="checkbox" className={styles.checkbox} checked={checked} onChange={() => onToggle(project.id, !checked)} />
                <span className={styles.box} aria-hidden="true">
                  {checked && <StrokeIcon name="check" size={13} />}
                </span>
                <span className={styles.name}>
                  {project.name}
                  {project.createdBy.by === "assistant" && <span className={styles.madeBy}>Made by {project.createdBy.name}</span>}
                </span>
                <span className={styles.count}>{items.length}</span>
              </label>
            );
          })}
          <button
            type="button"
            className={`${styles.option} ${styles.newProject}`}
            onClick={onNewProject}
            data-testid={projectPickerTestIds.newProjectButton}
          >
            <span className={styles.plus} aria-hidden="true">
              <StrokeIcon name="plus" size={14} />
            </span>
            <span className={styles.name}>New project…</span>
          </button>
        </div>
        <div className={styles.foot}>
          <span aria-live="polite" data-testid={projectPickerTestIds.foot}>
            {footLine(count)}
          </span>
          <button type="button" className={styles.done} onClick={onClose} data-testid={projectPickerTestIds.doneButton}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

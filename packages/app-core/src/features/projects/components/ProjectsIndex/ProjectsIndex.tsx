import { useId, useState } from "react";
import type { Project } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { projectShortDate } from "../../util/projectDates.js";
import type { ProjectSummary } from "../../util/projectSummaries.js";
import styles from "./ProjectsIndex.module.scss";
import { projectsIndexTestIds } from "./ProjectsIndexTestIds.js";

export interface ProjectsIndexProps {
  active: ProjectSummary[];
  archived: ProjectSummary[];
  now: Date;
  onNew: () => void;
  onOpen: (project: Project) => void;
  onRestore: (project: Project) => void;
  onArchivedShown: (shown: boolean) => void;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Every active project as a card, then the archived ones as a group of their own: the only
// place they are listed ("OV-168 1 Where Projects Live" 168e).
export function ProjectsIndex({ active, archived, now, onNew, onOpen, onRestore, onArchivedShown }: ProjectsIndexProps) {
  const [archivedShown, setArchivedShown] = useState(false);
  const archivedId = useId();

  return (
    <div className={styles.root} data-testid={projectsIndexTestIds.root}>
      <PageLink className={styles.back} to={Routes.home()}>
        <StrokeIcon name="arrowLeft" size={15} />
        All overviews
      </PageLink>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>All projects</h1>
          <p className={styles.summary} data-testid={projectsIndexTestIds.summary}>
            {plural(active.length, "project", "projects")}
            {archived.length > 0 && ` · ${archived.length} archived`}
          </p>
        </div>
        <button type="button" className={styles.newProject} onClick={onNew} data-testid={projectsIndexTestIds.newProjectButton}>
          <StrokeIcon name="plus" />
          New project
        </button>
      </div>

      {active.length === 0 && (
        <p className={styles.empty} data-testid={projectsIndexTestIds.empty}>
          No projects yet. A project is something you’re working on, with what it’s for and the overviews that help.
        </p>
      )}

      <ul className={styles.grid}>
        {active.map(({ project, items, unread }) => (
          <li key={project.id}>
            <PageLink
              className={styles.card}
              to={Routes.project(project.id)}
              onClick={() => onOpen(project)}
              data-testid={projectsIndexTestIds.card(project.name)}
            >
              <span className={styles.name}>{project.name}</span>
              <span className={`${styles.purpose} ${project.purpose === null ? styles.noPurpose : ""}`}>
                {project.purpose ?? "What it’s for isn’t written yet"}
              </span>
              <span className={styles.facts}>
                <span>
                  <b>{items.length}</b> {items.length === 1 ? "overview" : "overviews"}
                </span>
                <span>{unread} unread</span>
                {project.createdBy.by === "assistant" && <span>Made by {project.createdBy.name}</span>}
              </span>
            </PageLink>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <>
          <button
            type="button"
            className={styles.group}
            onClick={() => {
              onArchivedShown(!archivedShown);
              setArchivedShown(!archivedShown);
            }}
            aria-expanded={archivedShown}
            aria-controls={archivedId}
            data-testid={projectsIndexTestIds.archivedToggle}
          >
            Archived · {archived.length}
            <StrokeIcon name={archivedShown ? "chevronUp" : "chevronDown"} />
          </button>
          <ul className={styles.grid} id={archivedId} hidden={!archivedShown}>
            {archived.map(({ project, items }) => (
              <li key={project.id} className={`${styles.card} ${styles.archived}`} data-testid={projectsIndexTestIds.card(project.name)}>
                <PageLink className={styles.name} to={Routes.project(project.id)} onClick={() => onOpen(project)}>
                  {project.name}
                </PageLink>
                {project.purpose !== null && <span className={styles.purpose}>{project.purpose}</span>}
                <span className={styles.facts}>
                  <span>
                    <b>{items.length}</b> {items.length === 1 ? "overview" : "overviews"}
                  </span>
                  <span>Archived {projectShortDate(project.archivedAt!, now)}</span>
                </span>
                <span>
                  <button
                    type="button"
                    className={styles.restore}
                    onClick={() => onRestore(project)}
                    aria-label={`Restore ${project.name}`}
                    data-testid={projectsIndexTestIds.restoreButton(project.name)}
                  >
                    <StrokeIcon name="archive" />
                    Restore
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

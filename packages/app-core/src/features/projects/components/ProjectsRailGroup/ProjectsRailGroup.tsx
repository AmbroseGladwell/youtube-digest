import type { Project, ProjectId } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ProjectSummary } from "../../util/projectSummaries.js";
import styles from "./ProjectsRailGroup.module.scss";
import { projectsRailGroupTestIds } from "./ProjectsRailGroupTestIds.js";

export interface ProjectsRailGroupProps {
  // Active projects, last changed first.
  active: ProjectSummary[];
  archived: number;
  current: ProjectId | null;
  onOpen: (project: Project) => void;
  onLeave: () => void;
  onAll: () => void;
  onNew: () => void;
}

const SHOWN = 5;

// Above Topic and always there: none is a heading and New project, five show last changed
// first, and All projects is the line under them once any exist ("OV-168 1 Where Projects
// Live" 168d).
export function ProjectsRailGroup({ active, archived, current, onOpen, onLeave, onAll, onNew }: ProjectsRailGroupProps) {
  const shown = active.slice(0, SHOWN);
  const currentHidden = current !== null && !shown.some(({ project }) => project.id === current);
  const listed = currentHidden ? [...shown, ...active.filter(({ project }) => project.id === current)] : shown;
  const allLabel = `${active.length > SHOWN ? `All ${active.length} projects` : "All projects"}${archived > 0 ? ` · ${archived} archived` : ""}`;

  return (
    <div className={styles.root} data-testid={projectsRailGroupTestIds.root}>
      <h2 className={styles.label}>Projects</h2>
      {listed.length > 0 && (
        <ul className={styles.list} aria-label="Projects">
          {listed.map(({ project, items }) => {
            const on = project.id === current;
            return (
              <li key={project.id}>
                <PageLink
                  className={`${styles.option} ${on ? styles.optionActive : ""}`}
                  to={on ? Routes.home() : Routes.project(project.id)}
                  aria-current={on ? "page" : undefined}
                  onClick={() => (on ? onLeave() : onOpen(project))}
                  data-testid={projectsRailGroupTestIds.project(project.name)}
                >
                  <span className={styles.name}>
                    <span className={styles.nameText}>{project.name}</span>
                    {project.createdBy.by === "assistant" && <span className={styles.madeBy}>Made by {project.createdBy.name}</span>}
                  </span>
                  <span className={styles.count}>{items.length}</span>
                </PageLink>
              </li>
            );
          })}
        </ul>
      )}
      {active.length + archived > 0 && (
        <PageLink className={styles.all} to={Routes.projects()} onClick={onAll} data-testid={projectsRailGroupTestIds.allProjectsLink}>
          {allLabel}
        </PageLink>
      )}
      <button type="button" className={styles.newProject} onClick={onNew} data-testid={projectsRailGroupTestIds.newProjectButton}>
        <StrokeIcon name="plus" />
        New project
      </button>
    </div>
  );
}

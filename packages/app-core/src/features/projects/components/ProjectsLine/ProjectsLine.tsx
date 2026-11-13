import { Fragment, useId, type ReactNode } from "react";
import type { Project } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ProjectsLine.module.scss";
import { projectsLineTestIds } from "./ProjectsLineTestIds.js";

export interface ProjectsLineProps {
  // Most recently changed first, archived left off.
  projects: Project[];
  // The panel opens a project in the web app; null where there is no web app to open.
  webApp: string | null | "here";
  onOpen: (project: Project) => void;
  onChange: (from: "line") => void;
}

const SHOWN_IN_FULL = 3;
const CUT_AT = 32;

const joined = (parts: ReactNode[]): ReactNode[] =>
  parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (index === parts.length - 1 ? " and " : ", ")}
      {part}
    </Fragment>
  ));

// Which projects the overview is in, on the From line's quiet scale: up to three by name,
// four or more as two and how many more ("OV-168 3 Adding and Making" 168r, 168r-3).
export function ProjectsLine({ projects, webApp, onOpen, onChange }: ProjectsLineProps) {
  if (projects.length === 0) return null;
  const shown = projects.length > SHOWN_IN_FULL ? projects.slice(0, 2) : projects;
  const more = projects.length - shown.length;
  const names = shown.map((project) => <ProjectName key={project.id} project={project} webApp={webApp} onOpen={onOpen} />);
  const parts =
    more === 0
      ? names
      : [
          ...names,
          <button
            key="more"
            type="button"
            className={styles.more}
            onClick={() => onChange("line")}
            aria-label={`${more} more projects: open the list`}
            data-testid={projectsLineTestIds.moreButton}
          >
            {more} more
          </button>,
        ];

  return (
    <p className={styles.root} data-testid={projectsLineTestIds.root}>
      <span className={styles.icon} aria-hidden="true">
        <StrokeIcon name="folder" size={14} />
      </span>
      <span className={styles.text}>
        In {joined(parts)}
        <span aria-hidden="true"> · </span>
        <button
          type="button"
          className={styles.change}
          onClick={() => onChange("line")}
          aria-label="Change projects"
          data-testid={projectsLineTestIds.changeButton}
        >
          Change
        </button>
      </span>
    </p>
  );
}

function ProjectName({
  project,
  webApp,
  onOpen,
}: {
  project: Project;
  webApp: ProjectsLineProps["webApp"];
  onOpen: (project: Project) => void;
}) {
  const tipId = useId();
  const cut = project.name.length > CUT_AT;
  const common = {
    className: `${styles.name} ${cut ? styles.cut : ""}`,
    "aria-describedby": cut ? tipId : undefined,
    onClick: () => onOpen(project),
    "data-testid": projectsLineTestIds.projectLink(project.name),
  };
  const link =
    webApp === "here" ? (
      <PageLink {...common} to={Routes.project(project.id)}>
        {project.name}
      </PageLink>
    ) : webApp === null ? (
      <span className={common.className} data-testid={common["data-testid"]}>
        {project.name}
      </span>
    ) : (
      <a {...common} href={new URL(Routes.project(project.id), webApp).href} target="_blank" rel="noopener">
        {project.name}
        <StrokeIcon name="openOut" size={12} />
      </a>
    );
  if (!cut) return link;
  return (
    <span className={styles.cutWrap}>
      {link}
      <span className={styles.tip} role="tooltip" id={tipId}>
        {project.name}
      </span>
    </span>
  );
}

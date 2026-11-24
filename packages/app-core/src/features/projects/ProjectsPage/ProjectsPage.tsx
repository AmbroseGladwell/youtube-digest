import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { ProjectsIndex } from "../components/ProjectsIndex/ProjectsIndex.js";
import { useUpdateProjectMutation } from "../mutations/useUpdateProjectMutation.js";
import { useNewProject } from "../useNewProject.js";
import { useProjectSummaries } from "../useProjectSummaries.js";
import { activeSummaries, archivedSummaries } from "../util/projectSummaries.js";
import styles from "./ProjectsPage.module.scss";
import { projectsPageTestIds } from "./ProjectsPageTestIds.js";

export interface ProjectsPageProps {
  overviews: OverviewWithState[];
}

// A top-level page of its own (design 399c-4), no longer a mode of the library.
export const ProjectsPage = ({ overviews }: ProjectsPageProps) => {
  const { summaries } = useProjectSummaries(overviews);
  const analytics = useAnalytics();
  const updateProject = useUpdateProjectMutation();
  const newProject = useNewProject(summaries.map(({ project }) => project.name));

  return (
    <main className={styles.root} data-testid={projectsPageTestIds.root}>
      <ProjectsIndex
        active={activeSummaries(summaries)}
        archived={archivedSummaries(summaries)}
        now={new Date()}
        onNew={() => newProject.open("index")}
        onOpen={(project) => analytics.projects.index.projectOpened({ projectId: project.id, archived: project.archivedAt !== null })}
        onRestore={(project) => {
          analytics.projects.page.restored({ projectId: project.id, from: "index" });
          updateProject.mutate({ projectId: project.id, patch: { archivedAt: null } });
        }}
        onArchivedShown={(shown) => analytics.projects.index.archivedShown({ shown })}
      />
      {newProject.dialog}
    </main>
  );
};

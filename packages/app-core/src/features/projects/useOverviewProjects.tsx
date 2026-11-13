import { useState } from "react";
import type { Overview, ProjectId } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../overviews/types/LibraryEntry.js";
import { ProjectPicker } from "./components/ProjectPicker/ProjectPicker.js";
import { ProjectsLine, type ProjectsLineProps } from "./components/ProjectsLine/ProjectsLine.js";
import { useSetProjectMemberMutation } from "./mutations/useSetProjectMemberMutation.js";
import { useNewProject } from "./useNewProject.js";
import { useProjectSummaries } from "./useProjectSummaries.js";
import { activeSummaries, projectsHolding } from "./util/projectSummaries.js";

// The projects an overview is in, from its own page: the line under the byline, Add to
// project… in ⋯, the picker both open, and New project… from the picker (168r–168x).
export function useOverviewProjects(overview: Overview | null, webApp: ProjectsLineProps["webApp"]) {
  const entries = useOverviewsWithStateQuery();
  const { summaries } = useProjectSummaries(readableEntries(entries.data ?? []));
  const [picking, setPicking] = useState(false);
  const setMember = useSetProjectMemberMutation();
  const analytics = useAnalytics();
  const active = activeSummaries(summaries);
  const holding = overview === null ? [] : projectsHolding(summaries, overview.id);
  const newProject = useNewProject(summaries.map(({ project }) => project.name));

  const openPicker = (from: "menu" | "line") => {
    if (overview === null) return;
    analytics.projects.picker.opened({ overviewId: overview.id, from });
    setPicking(true);
  };

  const toggle = (projectId: ProjectId, inProject: boolean) => {
    if (overview === null) return;
    if (inProject) {
      analytics.projects.membership.added({ projectId, overviewId: overview.id, from: "picker" });
    } else {
      const item = summaries.find(({ project }) => project.id === projectId)?.items.find((each) => each.overview.id === overview.id);
      analytics.projects.membership.removed({
        projectId,
        overviewId: overview.id,
        addedBy: item?.addedBy.by ?? "reader",
        from: "picker",
      });
    }
    setMember.mutate({ projectId, overviewId: overview.id, inProject });
  };

  const line = (
    <ProjectsLine
      projects={holding.map(({ project }) => project)}
      webApp={webApp}
      onOpen={(project) => analytics.projects.overviewLine.projectOpened({ projectId: project.id })}
      onChange={openPicker}
    />
  );

  const dialogs = (
    <>
      {picking && overview !== null && (
        <ProjectPicker
          summaries={active}
          holding={(projectId) => (holding.some(({ project }) => project.id === projectId) ? 1 : 0)}
          of={1}
          onToggle={toggle}
          onNewProject={() => {
            setPicking(false);
            newProject.open("picker", [{ id: overview.id, title: overview.source.title }]);
          }}
          onClose={() => {
            analytics.projects.picker.closed();
            setPicking(false);
          }}
        />
      )}
      {newProject.dialog}
    </>
  );

  return { count: holding.length, openPicker, line, dialogs };
}

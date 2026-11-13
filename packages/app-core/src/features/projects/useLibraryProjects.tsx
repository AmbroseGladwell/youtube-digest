import { useState } from "react";
import { useNavigate } from "react-router";
import { BY_READER, type OverviewId, type ProjectId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import type { LibraryPlace } from "../library/types/LibraryPlace.js";
import type { OverviewWithState } from "../overviews/types/OverviewWithState.js";
import { DeleteProjectDialog } from "./components/DeleteProjectDialog/DeleteProjectDialog.js";
import { ProjectEmpty } from "./components/ProjectEmpty/ProjectEmpty.js";
import { ProjectHead } from "./components/ProjectHead/ProjectHead.js";
import { ProjectsIndex } from "./components/ProjectsIndex/ProjectsIndex.js";
import { ProjectsRailGroup } from "./components/ProjectsRailGroup/ProjectsRailGroup.js";
import { useDeleteProjectMutation } from "./mutations/useDeleteProjectMutation.js";
import { useSetProjectMemberMutation } from "./mutations/useSetProjectMemberMutation.js";
import { useUpdateProjectMutation } from "./mutations/useUpdateProjectMutation.js";
import { readProjectNudgeKept, writeProjectNudgeKept } from "./projectNudgeStorage.js";
import { useAssistantConnections } from "./useAssistantConnections.js";
import { useNewProject } from "./useNewProject.js";
import { useProjectSummaries } from "./useProjectSummaries.js";
import { projectNudged } from "./util/projectNudge.js";
import { projectShortDate } from "./util/projectDates.js";
import { activeSummaries, archivedSummaries } from "./util/projectSummaries.js";

export interface AddedByLine {
  name: string;
  on: string;
  projectName: string;
  onRemove: () => void;
}

// Everything projects bring to the library: the rail's group, and, on a project's page, its
// head, which overviews are in it and what an empty one says (docs/features/projects.md).
export function useLibraryProjects(place: LibraryPlace, overviews: OverviewWithState[]) {
  const { summaries, loaded } = useProjectSummaries(overviews);
  const assistants = useAssistantConnections();
  const analytics = useAnalytics();
  const navigate = useNavigate();
  const accountId = useLibraryAccountId();
  const updateProject = useUpdateProjectMutation();
  const deleteProject = useDeleteProjectMutation();
  const setMember = useSetProjectMemberMutation();
  const newProject = useNewProject(summaries.map(({ project }) => project.name));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [keptNow, setKeptNow] = useState<ReadonlySet<string>>(new Set());
  const now = new Date();

  const active = activeSummaries(summaries);
  const archived = archivedSummaries(summaries);
  const currentId: ProjectId | null = place.kind === "project" ? place.projectId : null;
  const current = currentId === null ? null : (summaries.find(({ project }) => project.id === currentId) ?? null);

  const restore = (projectId: ProjectId, from: "page" | "index") => {
    analytics.projects.page.restored({ projectId, from });
    updateProject.mutate({ projectId, patch: { archivedAt: null } });
  };

  const railGroup = (
    <ProjectsRailGroup
      active={active}
      archived={archived.length}
      current={currentId}
      onOpen={(project) => analytics.projects.rail.projectOpened({ projectId: project.id })}
      onLeave={() => analytics.projects.rail.projectLeft()}
      onAll={() => analytics.projects.rail.allProjectsOpened()}
      onNew={() => newProject.open("rail")}
    />
  );

  const index = (
    <ProjectsIndex
      active={active}
      archived={archived}
      now={now}
      onNew={() => newProject.open("index")}
      onOpen={(project) => analytics.projects.index.projectOpened({ projectId: project.id, archived: project.archivedAt !== null })}
      onRestore={(project) => restore(project.id, "index")}
      onArchivedShown={(shown) => analytics.projects.index.archivedShown({ shown })}
    />
  );

  const head =
    current === null ? null : (
      <ProjectHead
        summary={current}
        now={now}
        assistantConnected={assistants.any}
        nudged={!keptNow.has(current.project.id) && projectNudged(current, readProjectNudgeKept(accountId, current.project.id), now)}
        onRename={(name) => {
          analytics.projects.page.renamed({ projectId: current.project.id });
          updateProject.mutate({ projectId: current.project.id, patch: { name } });
        }}
        onPurpose={(purpose) => {
          analytics.projects.page.purposeEdited({
            projectId: current.project.id,
            replacedAssistants: current.project.purposeBy?.by === "assistant",
            cleared: purpose === null,
          });
          updateProject.mutate({ projectId: current.project.id, patch: { purpose, purposeBy: purpose === null ? null : BY_READER } });
        }}
        onArchive={(from) => {
          analytics.projects.page.archived({ projectId: current.project.id, from });
          updateProject.mutate({ projectId: current.project.id, patch: { archivedAt: new Date().toISOString() } });
        }}
        onRestore={() => restore(current.project.id, "page")}
        onKeep={() => {
          analytics.projects.page.nudgeKept({ projectId: current.project.id });
          writeProjectNudgeKept(accountId, current.project.id, new Date().toISOString());
          setKeptNow((kept) => new Set(kept).add(current.project.id));
        }}
        onDelete={() => {
          analytics.projects.page.deleteAsked({ projectId: current.project.id });
          setConfirmingDelete(true);
        }}
        onCopied={() => analytics.projects.page.markdownCopied({ projectId: current.project.id, overviews: current.items.length })}
      />
    );

  const empty =
    current === null || current.items.length > 0 ? null : (
      <ProjectEmpty
        name={current.project.name}
        assistantWrites={assistants.writes}
        onPromptCopied={() => analytics.projects.page.promptCopied({ projectId: current.project.id })}
      />
    );

  const addedByFor = (overviewId: OverviewId): AddedByLine | null => {
    if (current === null) return null;
    const item = current.items.find((each) => each.overview.id === overviewId);
    if (item === undefined || item.addedBy.by !== "assistant") return null;
    const { project } = current;
    return {
      name: item.addedBy.name,
      on: projectShortDate(item.addedAt, now),
      projectName: project.name,
      onRemove: () => {
        analytics.projects.membership.removed({ projectId: project.id, overviewId, addedBy: "assistant", from: "row" });
        setMember.mutate({ projectId: project.id, overviewId, inProject: false });
      },
    };
  };

  const dialogs = (
    <>
      {newProject.dialog}
      {confirmingDelete && current !== null && (
        <DeleteProjectDialog
          name={current.project.name}
          overviews={current.items.length}
          assistantConnected={assistants.any}
          onDelete={() => {
            analytics.projects.page.deleted({ projectId: current.project.id, overviews: current.items.length });
            setConfirmingDelete(false);
            deleteProject.mutate({ projectId: current.project.id });
            void navigate(Routes.home());
          }}
          onClose={() => {
            analytics.projects.page.deleteKept({ projectId: current.project.id });
            setConfirmingDelete(false);
          }}
        />
      )}
    </>
  );

  return {
    loaded,
    current,
    missing: loaded && currentId !== null && current === null,
    inScope: current === null ? null : new Set<string>(current.items.map((item) => item.overview.id)),
    railGroup,
    index,
    head,
    empty,
    addedByFor,
    dialogs,
  };
}

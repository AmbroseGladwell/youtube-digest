import { useState } from "react";
import { useNavigate } from "react-router";
import { BY_READER, type OverviewId, type ProjectId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import type { LibraryPlace } from "../library/types/LibraryPlace.js";
import type { OverviewWithState } from "../overviews/types/OverviewWithState.js";
import { DeleteProjectDialog } from "./components/DeleteProjectDialog/DeleteProjectDialog.js";
import { ProjectPicker } from "./components/ProjectPicker/ProjectPicker.js";
import { ProjectEmpty } from "./components/ProjectEmpty/ProjectEmpty.js";
import { ProjectHead } from "./components/ProjectHead/ProjectHead.js";
import { useDeleteProjectMutation } from "./mutations/useDeleteProjectMutation.js";
import { useSetProjectMemberMutation } from "./mutations/useSetProjectMemberMutation.js";
import { useUpdateProjectMutation } from "./mutations/useUpdateProjectMutation.js";
import { readProjectNudgeKept, writeProjectNudgeKept } from "./projectNudgeStorage.js";
import { useAssistantConnections } from "./useAssistantConnections.js";
import { useNewProject } from "./useNewProject.js";
import { useProjectSuggestions } from "./useProjectSuggestions.js";
import { useProjectSummaries } from "./useProjectSummaries.js";
import { projectNudged } from "./util/projectNudge.js";
import { projectShortDate } from "./util/projectDates.js";
import { activeSummaries } from "./util/projectSummaries.js";
import type { BulkAction } from "../library/util/bulkActionToast.js";
import { pickerAction, type PickerChange } from "../library/util/pickerAction.js";

interface Filing {
  overviews: OverviewWithState[];
  changes: Map<ProjectId, PickerChange>;
  writes: Promise<unknown>[];
  onFiled: (action: BulkAction | null, writes: Promise<unknown>[]) => void;
}

export interface LibraryProjectsHost {
  say: (text: string, undo: () => void) => void;
  focusList: () => void;
  selecting: boolean;
}

export interface AddedByLine {
  label: string;
  on: string;
  projectName: string;
  onRemove: () => void;
}

export const useLibraryProjects = (place: LibraryPlace, overviews: OverviewWithState[], host: LibraryProjectsHost) => {
  const { summaries, loaded } = useProjectSummaries(overviews);
  const assistants = useAssistantConnections();
  const analytics = useAnalytics();
  const navigate = useNavigate();
  const accountId = useLibraryAccountId();
  const { connection } = useSyncConnection();
  const updateProject = useUpdateProjectMutation();
  const deleteProject = useDeleteProjectMutation();
  const setMember = useSetProjectMemberMutation();
  const newProject = useNewProject(summaries.map(({ project }) => project.name));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [keptNow, setKeptNow] = useState<ReadonlySet<string>>(new Set());
  const [filing, setFiling] = useState<Filing | null>(null);
  const now = new Date();

  const active = activeSummaries(summaries);
  const currentId: ProjectId | null = place.kind === "project" ? place.projectId : null;
  const current = currentId === null ? null : (summaries.find(({ project }) => project.id === currentId) ?? null);
  const [purposeAsked, setPurposeAsked] = useState(0);
  const suggestions = useProjectSuggestions(current, overviews, {
    say: host.say,
    focusList: host.focusList,
    editPurpose: () => setPurposeAsked((asked) => asked + 1),
  });

  const restore = (projectId: ProjectId) => {
    analytics.projects.page.restored({ projectId, from: "page" });
    updateProject.mutate({ projectId, patch: { archivedAt: null } });
  };

  const head =
    current === null ? null : (
      <ProjectHead
        summary={current}
        now={now}
        assistantConnected={assistants.any}
        askable={isConnected(connection)}
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
        onRestore={() => restore(current.project.id)}
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
        suggestionsLine={host.selecting ? null : suggestions.line}
        purposeAsked={purposeAsked}
      />
    );

  const empty =
    current === null || current.items.length > 0 ? null : (
      <ProjectEmpty
        name={current.project.name}
        assistantWrites={assistants.writes}
        writerName={assistants.writerName}
        afterSuggestions={suggestions.offering}
        onPromptCopied={() => analytics.projects.page.promptCopied({ projectId: current.project.id })}
      />
    );

  const addedByFor = (overviewId: OverviewId): AddedByLine | null => {
    if (current === null) {
      return null;
    }
    const item = current.items.find((each) => each.overview.id === overviewId);
    if (item === undefined || item.addedBy.by === "reader") {
      return null;
    }
    const { project } = current;
    const { addedBy } = item;
    return {
      label: addedBy.by === "assistant" ? `Added by ${addedBy.name}` : "Added automatically",
      on: projectShortDate(item.addedAt, now),
      projectName: project.name,
      onRemove: () => {
        analytics.projects.membership.removed({ projectId: project.id, overviewId, addedBy: addedBy.by, from: "row" });
        setMember.mutate({ projectId: project.id, overviewId, inProject: false });
      },
    };
  };

  const removeFromCurrent = (overviewIds: OverviewId[]): Promise<unknown>[] => {
    if (current === null) {
      return [];
    }
    const writes: Promise<unknown>[] = [];
    for (const overviewId of overviewIds) {
      const item = current.items.find((each) => each.overview.id === overviewId);
      if (item === undefined) {
        continue;
      }
      analytics.projects.membership.removed({ projectId: current.project.id, overviewId, addedBy: item.addedBy.by, from: "selection" });
      writes.push(setMember.mutateAsync({ projectId: current.project.id, overviewId, inProject: false }));
    }
    return writes;
  };

  const holding = (projectId: ProjectId, overviews: OverviewWithState[]) => {
    const summary = summaries.find(({ project }) => project.id === projectId);
    return overviews.filter(({ overview }) => summary?.items.some((item) => item.overview.id === overview.id)).length;
  };

  const fileSelection = (projectId: ProjectId, inProject: boolean) => {
    const summary = summaries.find(({ project }) => project.id === projectId);
    if (filing === null || summary === undefined) {
      return;
    }
    const change = filing.changes.get(projectId);
    if (change === undefined) {
      filing.changes.set(projectId, { place: summary.project.name, heldBefore: holding(projectId, filing.overviews), given: inProject });
    } else {
      change.given = inProject;
    }
    for (const { overview } of filing.overviews) {
      const item = summary.items.find((each) => each.overview.id === overview.id);
      if (inProject === (item !== undefined)) {
        continue;
      }
      if (inProject) {
        analytics.projects.membership.added({ projectId, overviewId: overview.id, from: "selection" });
      } else {
        analytics.projects.membership.removed({ projectId, overviewId: overview.id, addedBy: item!.addedBy.by, from: "selection" });
      }
      filing.writes.push(setMember.mutateAsync({ projectId, overviewId: overview.id, inProject }));
    }
  };

  const finishFiling = (session: Filing, created: PickerChange[] = []) =>
    session.onFiled(pickerAction([...session.changes.values(), ...created], session.overviews.length, "project"), session.writes);

  const dialogs = (
    <>
      {filing !== null && (
        <ProjectPicker
          summaries={active}
          holding={(projectId) => holding(projectId, filing.overviews)}
          of={filing.overviews.length}
          onToggle={fileSelection}
          onNewProject={() => {
            setFiling(null);
            newProject.open(
              "selection",
              filing.overviews.map(({ overview }) => ({ id: overview.id, title: overview.source.title })),
              (created) => finishFiling(filing, created === null ? [] : [{ place: created.name, heldBefore: 0, given: true }]),
            );
          }}
          onClose={() => {
            setFiling(null);
            finishFiling(filing);
          }}
        />
      )}
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
    head,
    suggestions: host.selecting ? null : suggestions.group,
    empty,
    addedByFor,
    fileSelection: (overviews: OverviewWithState[], onFiled: Filing["onFiled"]) =>
      setFiling({ overviews, changes: new Map(), writes: [], onFiled }),
    removeFromCurrent,
    dialogs,
  };
};

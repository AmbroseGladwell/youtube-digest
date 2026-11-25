import { useState } from "react";
import type { ProjectId } from "@overview/domain";
import { ChecklistPicker } from "../../../../components/shared/ChecklistPicker/ChecklistPicker.js";
import {
  checklistOptionState,
  sharedChecklistFoot,
  sharedChecklistHint,
} from "../../../../components/shared/ChecklistPicker/checklistOptionState.js";
import type { ProjectSummary } from "../../util/projectSummaries.js";
import { projectPickerTestIds } from "./ProjectPickerTestIds.js";

export interface ProjectPickerProps {
  open?: boolean;
  returnFocusTo?: HTMLElement | null | undefined;
  // Last changed first.
  summaries: ProjectSummary[];
  // How many of the overviews being filed each project holds, out of `of`.
  holding: (projectId: ProjectId) => number;
  of: number;
  onToggle: (projectId: ProjectId, inProject: boolean) => void;
  onNewProject: () => void;
  onClose: () => void;
}

const footLine = (count: number): string => {
  if (count === 0) {
    return "Not in a project yet";
  }
  return count === 1 ? "In 1 project" : `In ${count} projects`;
};

const detailLine = (project: ProjectSummary["project"], held: number, of: number): string | null => {
  if (of > 1 && held > 0 && held < of) {
    return `${held} of ${of} in it`;
  }
  return project.createdBy.by === "assistant" ? `Made by ${project.createdBy.name}` : null;
};

const inOrderAsOpened = (summaries: ProjectSummary[], openedOrder: ProjectId[]): ProjectSummary[] => {
  const place = (id: ProjectId) => openedOrder.indexOf(id);
  return [...summaries].sort((left, right) => place(left.project.id) - place(right.project.id));
};

export const ProjectPicker = ({
  open = true,
  returnFocusTo,
  summaries,
  holding,
  of,
  onToggle,
  onNewProject,
  onClose,
}: ProjectPickerProps) => {
  const [openedOrder, setOpenedOrder] = useState(() => summaries.map(({ project }) => project.id));
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setOpenedOrder(summaries.map(({ project }) => project.id));
    }
  }
  const ordered = inOrderAsOpened(summaries, openedOrder);
  const options = ordered.map(({ project, items }) => {
    const held = holding(project.id);
    return {
      id: project.id,
      name: project.name,
      detail: detailLine(project, held, of),
      count: items.length,
      state: checklistOptionState(held, of),
    };
  });

  return (
    <ChecklistPicker
      open={open}
      returnFocusTo={returnFocusTo}
      heading={of === 1 ? "Add to projects" : `Projects for ${of} overviews`}
      hint={of === 1 ? "Changes save as you go." : sharedChecklistHint}
      groupLabel="Projects"
      findPlaceholder="Find a project"
      options={options}
      onToggle={(id, give) => onToggle(id as ProjectId, give)}
      newLabel="New project…"
      onNew={onNewProject}
      foot={
        of === 1
          ? footLine(options.filter(({ state }) => state === "all").length)
          : sharedChecklistFoot(
              options.map(({ name }, index) => ({ name, held: holding(ordered[index]!.project.id) })),
              of,
              "None of them is in a project yet",
            )
      }
      onClose={onClose}
      testIds={projectPickerTestIds}
    />
  );
};

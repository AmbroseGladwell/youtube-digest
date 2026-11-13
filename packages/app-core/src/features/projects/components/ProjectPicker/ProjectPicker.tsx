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
  // Active projects, last changed first.
  summaries: ProjectSummary[];
  // How many of the overviews being filed each project holds, out of `of`.
  holding: (projectId: ProjectId) => number;
  of: number;
  onToggle: (projectId: ProjectId, inProject: boolean) => void;
  onNewProject: () => void;
  onClose: () => void;
}

const footLine = (count: number): string => (count === 0 ? "Not in a project yet" : count === 1 ? "In 1 project" : `In ${count} projects`);

export function ProjectPicker({ summaries, holding, of, onToggle, onNewProject, onClose }: ProjectPickerProps) {
  const options = summaries.map(({ project, items }) => {
    const held = holding(project.id);
    return {
      id: project.id,
      name: project.name,
      detail:
        of > 1 && held > 0 && held < of
          ? `${held} of ${of} in it`
          : project.createdBy.by === "assistant"
            ? `Made by ${project.createdBy.name}`
            : null,
      count: items.length,
      state: checklistOptionState(held, of),
    };
  });

  return (
    <ChecklistPicker
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
              options.map(({ name }, index) => ({ name, held: holding(summaries[index]!.project.id) })),
              of,
              "None of them is in a project yet",
            )
      }
      onClose={onClose}
      testIds={projectPickerTestIds}
    />
  );
}

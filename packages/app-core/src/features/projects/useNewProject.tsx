import { useState } from "react";
import { useKeptWhileClosing } from "../../util/useKeptWhileClosing.js";
import { useNavigate } from "react-router";
import type { OverviewId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { NewProjectDialog } from "./components/NewProjectDialog/NewProjectDialog.js";
import { useCreateProjectMutation } from "./mutations/useCreateProjectMutation.js";
import { useAssistantConnections } from "./useAssistantConnections.js";

export type NewProjectFrom = "sidebar" | "index" | "picker" | "selection";

interface Adding {
  from: NewProjectFrom;
  overviews: { id: OverviewId; title: string }[];
  onDone: ((created: { name: string } | null) => void) | null;
}

const addsOf = (overviews: Adding["overviews"]) => {
  if (overviews.length === 0) {
    return null;
  }
  return overviews.length === 1 ? { title: overviews[0]!.title } : { count: overviews.length };
};

export const useNewProject = (takenNames: string[]) => {
  const [adding, setAdding] = useState<Adding | null>(null);
  const kept = useKeptWhileClosing(adding);
  const create = useCreateProjectMutation();
  const analytics = useAnalytics();
  const assistants = useAssistantConnections();
  const navigate = useNavigate();

  const open = (from: NewProjectFrom, overviews: Adding["overviews"] = [], onDone: Adding["onDone"] = null) => {
    analytics.projects.newProjectDialog.opened({ from });
    setAdding({ from, overviews, onDone });
  };

  const dialog =
    kept.kept === null ? null : (
      <NewProjectDialog
        open={kept.open}
        adds={addsOf(kept.kept.overviews)}
        assistantConnected={assistants.any}
        takenNames={takenNames}
        busy={create.isPending}
        onCreate={({ name, purpose }) =>
          create.mutate(
            { name, purpose, overviewIds: kept.kept!.overviews.map(({ id }) => id) },
            {
              onSuccess: (project) => {
                const done = kept.kept!;
                analytics.projects.newProjectDialog.created({ projectId: project.id, from: done.from, hasPurpose: purpose !== null });
                for (const { id } of done.overviews) {
                  analytics.projects.membership.added({ projectId: project.id, overviewId: id, from: "newProject" });
                }
                setAdding(null);
                done.onDone?.({ name: project.name });
                if (done.from === "sidebar" || done.from === "index") {
                  void navigate(Routes.project(project.id));
                }
              },
            },
          )
        }
        onClose={() => {
          analytics.projects.newProjectDialog.cancelled();
          setAdding(null);
          kept.kept?.onDone?.(null);
        }}
      />
    );

  return { open, dialog };
};

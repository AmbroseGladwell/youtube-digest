import { useState } from "react";
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
  const create = useCreateProjectMutation();
  const analytics = useAnalytics();
  const assistants = useAssistantConnections();
  const navigate = useNavigate();

  const open = (from: NewProjectFrom, overviews: Adding["overviews"] = [], onDone: Adding["onDone"] = null) => {
    analytics.projects.newProjectDialog.opened({ from });
    setAdding({ from, overviews, onDone });
  };

  const dialog =
    adding === null ? null : (
      <NewProjectDialog
        adds={addsOf(adding.overviews)}
        assistantConnected={assistants.any}
        takenNames={takenNames}
        busy={create.isPending}
        onCreate={({ name, purpose }) =>
          create.mutate(
            { name, purpose, overviewIds: adding.overviews.map(({ id }) => id) },
            {
              onSuccess: (project) => {
                analytics.projects.newProjectDialog.created({ projectId: project.id, from: adding.from, hasPurpose: purpose !== null });
                for (const { id } of adding.overviews) {
                  analytics.projects.membership.added({ projectId: project.id, overviewId: id, from: "newProject" });
                }
                setAdding(null);
                adding.onDone?.({ name: project.name });
                if (adding.from === "sidebar" || adding.from === "index") {
                  void navigate(Routes.project(project.id));
                }
              },
            },
          )
        }
        onClose={() => {
          analytics.projects.newProjectDialog.cancelled();
          setAdding(null);
          adding.onDone?.(null);
        }}
      />
    );

  return { open, dialog };
};

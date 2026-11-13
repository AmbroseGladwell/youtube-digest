import { useState } from "react";
import { useNavigate } from "react-router";
import type { OverviewId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { NewProjectDialog } from "./components/NewProjectDialog/NewProjectDialog.js";
import { useCreateProjectMutation } from "./mutations/useCreateProjectMutation.js";
import { useAssistantConnections } from "./useAssistantConnections.js";

export type NewProjectFrom = "rail" | "index" | "picker";

interface Adding {
  from: NewProjectFrom;
  overview: { id: OverviewId; title: string } | null;
}

// The create dialog and what follows it: from the rail or the index it opens the new
// project's page; from the picker it adds the overview and stays where it is (168x).
export function useNewProject(takenNames: string[]) {
  const [adding, setAdding] = useState<Adding | null>(null);
  const create = useCreateProjectMutation();
  const analytics = useAnalytics();
  const assistants = useAssistantConnections();
  const navigate = useNavigate();

  const open = (from: NewProjectFrom, overview: Adding["overview"] = null) => {
    analytics.projects.newProjectDialog.opened({ from });
    setAdding({ from, overview });
  };

  const dialog =
    adding === null ? null : (
      <NewProjectDialog
        adds={adding.overview?.title ?? null}
        assistantConnected={assistants.any}
        takenNames={takenNames}
        busy={create.isPending}
        onCreate={({ name, purpose }) =>
          create.mutate(
            { name, purpose, overviewIds: adding.overview === null ? [] : [adding.overview.id] },
            {
              onSuccess: (project) => {
                analytics.projects.newProjectDialog.created({ projectId: project.id, from: adding.from, hasPurpose: purpose !== null });
                if (adding.overview !== null) {
                  analytics.projects.membership.added({ projectId: project.id, overviewId: adding.overview.id, from: "newProject" });
                }
                setAdding(null);
                if (adding.overview === null) void navigate(Routes.project(project.id));
              },
            },
          )
        }
        onClose={() => {
          analytics.projects.newProjectDialog.cancelled();
          setAdding(null);
        }}
      />
    );

  return { open, dialog };
}

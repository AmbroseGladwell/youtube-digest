import { useState } from "react";
import { useNavigate } from "react-router";
import type { OverviewId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { NewProjectDialog } from "./components/NewProjectDialog/NewProjectDialog.js";
import { useCreateProjectMutation } from "./mutations/useCreateProjectMutation.js";
import { useAssistantConnections } from "./useAssistantConnections.js";

export type NewProjectFrom = "rail" | "index" | "picker" | "selection";

interface Adding {
  from: NewProjectFrom;
  overviews: { id: OverviewId; title: string }[];
}

// The create dialog and what follows it: from the rail or the index it opens the new
// project's page; from a picker it adds the overviews and stays where it is (168x).
export function useNewProject(takenNames: string[]) {
  const [adding, setAdding] = useState<Adding | null>(null);
  const create = useCreateProjectMutation();
  const analytics = useAnalytics();
  const assistants = useAssistantConnections();
  const navigate = useNavigate();

  const open = (from: NewProjectFrom, overviews: Adding["overviews"] = []) => {
    analytics.projects.newProjectDialog.opened({ from });
    setAdding({ from, overviews });
  };

  const dialog =
    adding === null ? null : (
      <NewProjectDialog
        adds={
          adding.overviews.length === 0
            ? null
            : adding.overviews.length === 1
              ? { title: adding.overviews[0]!.title }
              : { count: adding.overviews.length }
        }
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
                if (adding.from === "rail" || adding.from === "index") void navigate(Routes.project(project.id));
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

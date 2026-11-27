import { useState } from "react";
import { DEFAULT_PLAN } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import type { ManageTopicsStart, UndoOffer } from "./components/ManageTopicsDialog/ManageTopicsDialog.js";

export type ManageTopicsFrom = "sidebar" | "filterMenu" | "topicPage";

// The host's toast carries a merge's Undo once the dialog closes (design 10f-3).
export const useManageTopics = (say: (text: string, undo: () => void) => void) => {
  const analytics = useAnalytics().library.manageTopics;
  const plan = useSettingsQuery().data?.plan ?? DEFAULT_PLAN;
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<ManageTopicsStart>({ step: "list" });

  return {
    open: (from: ManageTopicsFrom, next: ManageTopicsStart = { step: "list" }) => {
      analytics.opened({ from, plan });
      setStart(next);
      setOpen(true);
    },
    dialog: {
      open,
      start,
      onClose: (undo: UndoOffer | null) => {
        setOpen(false);
        if (undo !== null) {
          say(undo.text, () => {
            undo.undo();
            analytics.undone({ from: "toast", plan });
          });
        }
      },
    },
  };
};

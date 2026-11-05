import { useRef } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router";
import { EMPTY_HISTORY_TRAIL, advanceHistoryTrail, type HistoryMove, type HistoryTrail } from "./historyTrail.js";

const moveOf = (type: NavigationType): HistoryMove =>
  type === NavigationType.Push ? "PUSH" : type === NavigationType.Replace ? "REPLACE" : "POP";

export function useHistoryTrail(): HistoryTrail {
  const location = useLocation();
  const type = useNavigationType();
  const trail = useRef(EMPTY_HISTORY_TRAIL);
  if (trail.current.entries[trail.current.index]?.key !== location.key) {
    trail.current = advanceHistoryTrail(trail.current, moveOf(type), { key: location.key, pathname: location.pathname });
  }
  return trail.current;
}

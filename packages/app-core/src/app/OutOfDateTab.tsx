import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";

// Replaces the whole tree once another context upgraded the database: every store call would now throw.
export const OutOfDateTab = () => {
  return (
    <ErrorState
      screen="outOfDateTab"
      title="This tab is out of date"
      body="Another window updated your library. Reload to catch up."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
    />
  );
};

import { useAppUpdate, type AppUpdate } from "../../../../app/AppUpdateContext.js";
import { useSurface, type Surface } from "../../../../app/SurfaceContext.js";
import { ErrorState, type ErrorStateAction } from "../../../../components/shared/ErrorState/ErrorState.js";

export interface WriteFloorWallProps {
  generating: boolean;
}

const updateActionFor = (surface: Surface, appUpdate: AppUpdate | null): ErrorStateAction | undefined => {
  if (surface === "web") {
    return { label: "Reload", onSelect: () => globalThis.location.reload() };
  }
  return appUpdate === null ? undefined : { label: appUpdate.label, onSelect: appUpdate.apply };
};

const wallBodyFor = (generating: boolean, surface: Surface): string => {
  if (generating) {
    return "Waiting for the overview you're generating. Dismiss it to update now.";
  }
  return surface === "web"
    ? "Reload to pick up the current version. Everything you have is still here."
    : "Chrome will update the extension on its own schedule. Everything you have is still here, and will sync once it does.";
};

// Below minSupportedClientVersion every write fails, so the app is replaced by an honest
// wall rather than left looking like it works. It stands in for the pane rather than the
// tree, so the shell and any generation it owns keep running, and the update action is
// held back while a run is in flight: it neither refunds nor aborts, it only discards
// (docs/features/record-migrations.md, "Below the write floor is a wall").
export const WriteFloorWall = ({ generating }: WriteFloorWallProps) => {
  const surface = useSurface();
  const appUpdate = useAppUpdate();
  const action = updateActionFor(surface, appUpdate);

  return (
    <ErrorState
      screen="writeFloor"
      title="This version of the app can no longer sync"
      body={wallBodyFor(generating, surface)}
      action={generating ? undefined : action}
    />
  );
};

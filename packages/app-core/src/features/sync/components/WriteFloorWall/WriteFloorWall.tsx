import { useAppUpdate } from "../../../../app/AppUpdateContext.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { ErrorState } from "../../../../components/shared/ErrorState/ErrorState.js";

export interface WriteFloorWallProps {
  generating: boolean;
}

// Below minSupportedClientVersion every write fails, so the app is replaced by an honest
// wall rather than left looking like it works. It stands in for the pane rather than the
// tree, so the shell and any generation it owns keep running, and the update action is
// held back while a run is in flight: it neither refunds nor aborts, it only discards
// (docs/features/record-migrations.md, "Below the write floor is a wall").
export function WriteFloorWall({ generating }: WriteFloorWallProps) {
  const surface = useSurface();
  const appUpdate = useAppUpdate();
  const action =
    surface === "web"
      ? { label: "Reload", onSelect: () => globalThis.location.reload() }
      : appUpdate === null
        ? undefined
        : { label: appUpdate.label, onSelect: appUpdate.apply };

  return (
    <ErrorState
      title="This version of the app can no longer sync"
      body={
        generating
          ? "Waiting for the overview you're generating. Dismiss it to update now."
          : surface === "web"
            ? "Reload to pick up the current version. Everything you have is still here."
            : "Chrome will update the extension on its own schedule. Everything you have is still here, and will sync once it does."
      }
      action={generating ? undefined : action}
    />
  );
}

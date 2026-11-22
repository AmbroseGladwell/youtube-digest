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

// Why a wall: docs/features/record-migrations.md, "Below the write floor is a wall, not a banner".
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

import { useMemo } from "react";
import { analyticsPlatform, type AnalyticsContext } from "@overview/domain";
import { useAppBuild } from "../../app/AppBuildContext.js";
import { useLayout } from "../../app/LayoutContext.js";
import { useSurface } from "../../app/SurfaceContext.js";

const SEMVER = /^\d+\.\d+\.\d+$/;

// What every event and error in a batch has in common (docs/architecture/analytics.md,
// "What an event may carry").
export function useAnalyticsContext(): AnalyticsContext {
  const surface = useSurface();
  const layout = useLayout();
  const build = useAppBuild();
  return useMemo(
    () => ({
      surface,
      layout,
      appVersion: build !== null && SEMVER.test(build.version) ? build.version : null,
      platform: analyticsPlatform(globalThis.navigator),
    }),
    [surface, layout, build],
  );
}

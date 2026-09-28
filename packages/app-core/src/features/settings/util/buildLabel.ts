import type { AppBuild } from "../../../app/AppBuildContext.js";

export function buildLabel(build: AppBuild): string {
  if (build.commit === null) return `Version ${build.version}`;
  const commit = build.dirty ? `${build.commit}, uncommitted changes` : build.commit;
  return `Version ${build.version} (${commit})`;
}

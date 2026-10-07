import { foldDuplicateOverviews, type DuplicateFold } from "../records/foldDuplicateOverviews.js";
import type { MigrationSteps } from "./runMigrations.js";

// Code that has to run inside a migration's transaction, before its file: the unique index
// of V0018 cannot go on while an account holds two overviews of one video
// (docs/features/one-overview-per-video.md).
export const migrationSteps = (onFolded: (folds: DuplicateFold[]) => void = () => undefined): MigrationSteps => ({
  18: async (tx) => onFolded(await foldDuplicateOverviews(tx)),
});

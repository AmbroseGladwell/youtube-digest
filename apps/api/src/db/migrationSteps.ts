import { foldDuplicateOverviews, type DuplicateFold } from "../records/foldDuplicateOverviews.js";
import { moveSharesToSource } from "../shares/moveSharesToSource.js";
import type { MigrationSteps } from "./runMigrations.js";

// V0018's unique index cannot go on while an account holds two overviews of one video.
export const migrationSteps = (onFolded: (folds: DuplicateFold[]) => void = () => undefined): MigrationSteps => ({
  18: async (tx) => onFolded(await foldDuplicateOverviews(tx)),
  24: moveSharesToSource,
});

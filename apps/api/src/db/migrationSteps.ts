import { foldDuplicateOverviews, type DuplicateFold } from "../records/foldDuplicateOverviews.js";
import { foldDuplicateTopics, type DuplicateTopicFold } from "../records/foldDuplicateTopics.js";
import { moveSharesToSource } from "../shares/moveSharesToSource.js";
import type { MigrationSteps } from "./runMigrations.js";

export interface MigrationFolds {
  overviews?: (folds: DuplicateFold[]) => void;
  topics?: (folds: DuplicateTopicFold[]) => void;
}

// V0018's unique index cannot go on while an account holds two overviews of one video.
export const migrationSteps = ({ overviews = () => undefined, topics = () => undefined }: MigrationFolds = {}): MigrationSteps => ({
  18: async (tx) => overviews(await foldDuplicateOverviews(tx)),
  24: moveSharesToSource,
  51: async (tx) => topics(await foldDuplicateTopics(tx)),
});

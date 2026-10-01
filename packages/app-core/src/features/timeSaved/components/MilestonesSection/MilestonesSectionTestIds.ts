import type { MilestoneId } from "@overview/domain";

export const milestonesSectionTestIds = {
  root: "MilestonesSection.root",
  skeleton: "MilestonesSection.skeleton",
  figure: "MilestonesSection.figure",
  count: "MilestonesSection.count",
  next: "MilestonesSection.next",
  tiles: "MilestonesSection.tiles",
  tile: (id: MilestoneId) => `MilestonesSection.tile.${id}`,
  card: "MilestonesSection.card",
  cardsSwitch: "MilestonesSection.cardsSwitch",
};

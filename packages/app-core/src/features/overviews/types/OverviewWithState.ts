import type { Overview, OverviewState } from "@overview/domain";

export interface OverviewWithState {
  overview: Overview;
  state: OverviewState;
}

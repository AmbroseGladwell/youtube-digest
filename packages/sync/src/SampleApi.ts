import type { Sample, SharedOverview } from "@overview/domain";

// Start's samples, read signed out: the list to choose from, then the whole copy of the one
// chosen (docs/features/onboarding.md, "Try a sample").
export interface SampleApi {
  list(): Promise<Sample[]>;
  get(token: string): Promise<SharedOverview>;
}

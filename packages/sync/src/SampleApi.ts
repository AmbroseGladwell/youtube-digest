import type { Sample, SharedOverview } from "@overview/domain";

export interface SampleApi {
  list(): Promise<Sample[]>;
  get(token: string): Promise<SharedOverview>;
}

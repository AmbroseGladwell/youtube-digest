import type {
  OurKeyGenerationRequest,
  OurKeyGenerationStatus,
  Overview,
  OverviewUsage,
  ProfilePassInput,
  ProfilePassResult,
  TrialToken,
} from "@overview/domain";

// Overviews made on our key through our server, and the account's monthly counts on each
// key (docs/architecture/tiers.md).
export interface GenerationApi {
  status(): Promise<OurKeyGenerationStatus>;
  usage(): Promise<OverviewUsage>;
  generate(request: OurKeyGenerationRequest): Promise<Overview>;
  // Never counted against the plan (docs/features/personalisation.md).
  profilePass(input: ProfilePassInput): Promise<ProfilePassResult>;
  // A slot on the own-key month before the device generates, or a saved share let in.
  reserve(overviewId: string, shareToken?: string): Promise<OverviewUsage>;
  release(overviewId: string): Promise<void>;
  // Signed out, a token for this device's trial, asked for before its first overview on our key.
  startTrial(): Promise<TrialToken>;
}

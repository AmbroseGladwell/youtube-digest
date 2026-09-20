import type { GeneralTranscriptParams, JobResult, Metadata, Transcript, TranscriptOrJobId } from "@supadata/js";

// The whole of Supadata's SDK this package is allowed to touch. Provider types stop here:
// nothing above supadata/ imports them (docs/features/transcript-retrieval.md).
export interface SupadataClient {
  metadata(params: { url: string }): Promise<Metadata>;
  transcript: ((params: GeneralTranscriptParams) => Promise<TranscriptOrJobId>) & {
    getJobStatus(jobId: string): Promise<JobResult<Transcript>>;
  };
}

import type { GeneralTranscriptParams, JobResult, Metadata, Transcript, TranscriptOrJobId } from "@supadata/js";

export interface TranscriptSourceClient {
  metadata(params: { url: string }): Promise<Metadata>;
  transcript: ((params: GeneralTranscriptParams) => Promise<TranscriptOrJobId>) & {
    getJobStatus(jobId: string): Promise<JobResult<Transcript>>;
  };
}

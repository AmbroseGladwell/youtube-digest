import type { CaptureClaim, SourceKey } from "@overview/domain";

export interface CaptureClaimApi {
  claim(sourceKey: SourceKey, holder: string): Promise<CaptureClaim>;
  release(sourceKey: SourceKey, holder: string): Promise<void>;
}

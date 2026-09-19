import type { RunBridge } from "../../src/app/RunBridgeContext.js";
import type { RunReport } from "../../src/features/newOverview/types/RunReport.js";

export class IwftRunBridge implements RunBridge {
  readonly reports: Array<RunReport | null> = [];

  private readonly listeners = new Set<() => void>();
  private pending: string | null = null;

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  takeRequest = (): string | null => {
    const videoUrl = this.pending;
    this.pending = null;
    return videoUrl;
  };

  report = (report: RunReport | null): void => {
    this.reports.push(report);
  };

  // What pressing the injected button on the page amounts to, from app-core's side.
  requestOverview = (videoUrl: string): void => {
    this.pending = videoUrl;
    for (const listener of this.listeners) listener();
  };
}

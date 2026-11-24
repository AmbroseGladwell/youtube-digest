import { SourceKey, sourceKey, sourceUrl, type Overview, type SavedCapture } from "@overview/domain";

export const savedCaptureFrom = (overview: Overview, overrides: Partial<SavedCapture> = {}): SavedCapture => ({
  id: overview.id,
  sourceKey: sourceKey(overview.source) ?? SourceKey.parse("savedCaptureFrom"),
  url: sourceUrl(overview.source),
  keptAt: overview.savedAt,
  keptFrom: "web",
  captureReason: null,
  title: overview.source.title,
  thumbnailUrl: null,
  fromPlaylist: null,
  addedAt: null,
  playlistIndex: null,
  chosenAt: null,
  stage: "saved",
  source: overview.source,
  savedAt: overview.savedAt,
  notes: null,
  ...overrides,
});

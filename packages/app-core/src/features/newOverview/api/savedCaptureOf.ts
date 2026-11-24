import {
  articleSourceId,
  OverviewId,
  sourceKey,
  webSource,
  youTubeSource,
  type CaptureSurface,
  type ExtractedArticle,
  type PodcastSource,
  type SavedCapture,
  type SocialSource,
  type TikTokSource,
  type Source,
  type VideoSource,
} from "@overview/domain";

export type SavedSourceOf =
  | { video: VideoSource; article?: never }
  | { social: SocialSource; article: ExtractedArticle }
  | { podcast: PodcastSource }
  | { tiktok: TikTokSource }
  | { social: SocialSource }
  | { article: ExtractedArticle };

const sourceOf = async (what: SavedSourceOf): Promise<Source> => {
  if ("podcast" in what && what.podcast) {
    return what.podcast;
  }
  if ("tiktok" in what && what.tiktok) {
    return what.tiktok;
  }
  if ("social" in what && what.social) {
    return what.social;
  }
  if ("article" in what && what.article) {
    return webSource(what.article, await articleSourceId(what.article.url));
  }
  return youTubeSource((what as { video: VideoSource }).video);
};

const notesOf = (what: SavedSourceOf): string | null => {
  if ("video" in what && what.video) {
    return what.video.fullDescription ?? what.video.description;
  }
  if ("social" in what && "article" in what && what.article) {
    return what.article.sections.map((section) => section.text).join("\n\n");
  }
  return null;
};

const addressOf = (source: Source): string => (source.kind === "podcast" ? source.sharedFrom : source.url);

const thumbnailOf = (source: Source): string | null => ("thumbnailUrl" in source ? source.thumbnailUrl : source.imageUrl) ?? null;

export interface SavedCaptureRequest {
  id: OverviewId | undefined;
  keptFrom: CaptureSurface;
  captureReason: string | null;
  now: Date;
}

export const savedCaptureOf = async (
  what: SavedSourceOf,
  { id, keptFrom, captureReason, now }: SavedCaptureRequest,
): Promise<SavedCapture> => {
  const source = await sourceOf(what);
  const at = now.toISOString();
  return {
    id: id ?? OverviewId.parse(globalThis.crypto.randomUUID()),
    sourceKey: sourceKey(source)!,
    url: addressOf(source),
    keptAt: at,
    keptFrom,
    captureReason,
    title: source.title,
    thumbnailUrl: thumbnailOf(source),
    fromPlaylist: null,
    addedAt: null,
    playlistIndex: null,
    chosenAt: null,
    stage: "saved",
    source,
    savedAt: at,
    notes: notesOf(what),
  };
};

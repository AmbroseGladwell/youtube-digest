import { z } from "zod";

const Show = z.looseObject({
  wrapperType: z.literal("track"),
  collectionId: z.number(),
  collectionName: z.string(),
  feedUrl: z.string().optional(),
});

const Episode = z.looseObject({
  wrapperType: z.literal("podcastEpisode"),
  trackId: z.number(),
  trackName: z.string(),
  episodeGuid: z.string().optional(),
  releaseDate: z.string().optional(),
  trackTimeMillis: z.number().optional(),
  feedUrl: z.string().optional(),
});

const Results = z.object({ results: z.array(z.unknown()) });

export interface DirectoryShow {
  showId: string;
  showName: string;
  feedUrl: string | null;
}

export interface DirectoryEpisode {
  episodeId: string;
  guid: string | null;
  title: string;
  publishedAt: string | null;
  durationSeconds: number | null;
}

// What a Spotify link needs of a directory: the show by its name, and its newest episodes.
export interface ShowDirectory {
  searchShows(name: string): Promise<DirectoryShow[]>;
  showWithEpisodes(showId: string): Promise<{ show: DirectoryShow; episodes: DirectoryEpisode[] } | null>;
}

export type FetchJson = (url: string) => Promise<unknown>;

const LOOKUP = "https://itunes.apple.com/lookup";
const SEARCH = "https://itunes.apple.com/search";
const MOST_EPISODES = 200;

const toShow = (show: z.infer<typeof Show>): DirectoryShow => ({
  showId: String(show.collectionId),
  showName: show.collectionName,
  feedUrl: show.feedUrl ?? null,
});

const toEpisode = (episode: z.infer<typeof Episode>): DirectoryEpisode => {
  const released = Date.parse(episode.releaseDate ?? "");
  const seconds = Math.round((episode.trackTimeMillis ?? 0) / 1000);
  return {
    episodeId: String(episode.trackId),
    guid: episode.episodeGuid ?? null,
    title: episode.trackName,
    publishedAt: Number.isNaN(released) ? null : new Date(released).toISOString(),
    durationSeconds: seconds > 0 ? seconds : null,
  };
};

const parsed = <T>(schema: z.ZodType<T>, rows: readonly unknown[]): T[] =>
  rows.flatMap((row) => {
    const result = schema.safeParse(row);
    return result.success ? [result.data] : [];
  });

// Apple's free directory: a show's feed, and the guids of its newest episodes
// (docs/features/podcast-links.md, "From a link to an episode").
export function appleDirectory(fetchJson: FetchJson) {
  return {
    async showWithEpisodes(showId: string): Promise<{ show: DirectoryShow; episodes: DirectoryEpisode[] } | null> {
      const { results } = Results.parse(
        await fetchJson(`${LOOKUP}?id=${encodeURIComponent(showId)}&entity=podcastEpisode&limit=${MOST_EPISODES}`),
      );
      const [show] = parsed(Show, results);
      return show === undefined ? null : { show: toShow(show), episodes: parsed(Episode, results).map(toEpisode) };
    },
    async searchEpisodes(title: string): Promise<{ show: DirectoryShow; episode: DirectoryEpisode }[]> {
      const { results } = Results.parse(
        await fetchJson(`${SEARCH}?term=${encodeURIComponent(title)}&media=podcast&entity=podcastEpisode&limit=10`),
      );
      return parsed(Episode.extend({ collectionId: z.number(), collectionName: z.string() }), results).map((episode) => ({
        show: { showId: String(episode.collectionId), showName: episode.collectionName, feedUrl: episode.feedUrl ?? null },
        episode: toEpisode(episode),
      }));
    },
    async searchShows(name: string): Promise<DirectoryShow[]> {
      const { results } = Results.parse(
        await fetchJson(`${SEARCH}?term=${encodeURIComponent(name)}&media=podcast&entity=podcast&limit=10`),
      );
      return parsed(Show, results).map(toShow);
    },
  };
}

export type AppleDirectory = ReturnType<typeof appleDirectory>;

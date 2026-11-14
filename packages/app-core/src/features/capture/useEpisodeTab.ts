import { domainOf, podcastPlatform, type OverviewId, type PodcastEpisode } from "@overview/domain";
import { useActiveVideoUrl } from "../../app/ActiveVideoContext.js";
import { useActivePage } from "../../app/ArticlePagesContext.js";
import { isPlatformPodcastLink, isPodcastShowLink, usePodcastLink } from "../newOverview/usePodcastLink.js";
import type { ArticleFailureCopy } from "../newOverview/util/articleFailureCopy.js";
import { podcastLinkFailureCopy } from "../newOverview/util/podcastLinkFailureCopy.js";

export type EpisodeTabState =
  | { status: "reading"; host: string }
  | { status: "found"; episode: PodcastEpisode }
  | { status: "held"; episode: PodcastEpisode; overviewId: OverviewId }
  | { status: "show" }
  | { status: "failed"; copy: ArticleFailureCopy }
  | { status: "unreachable" };

export type EpisodeTab = EpisodeTabState & {
  url: string;
  // "Spotify" or "Apple Podcasts": the app the tab is open in.
  on: string;
  retry: () => void;
};

// Design 106k: a Spotify or Apple Podcasts tab beside the panel, read from its address alone by
// our server, so Chrome is never asked for the site. A show's page is known from the address and
// isn't sent anywhere. Null where there's no such tab, or no account on a server to read through.
export function useEpisodeTab(): EpisodeTab | null {
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const url = activeVideoUrl === null && activePage !== null && isPlatformPodcastLink(activePage.url) ? activePage.url : null;
  const show = url !== null && isPodcastShowLink(url);
  const podcast = usePodcastLink(url === null || show ? "" : url);

  if (url === null || !podcast.available) return null;
  const tab = { url, on: podcastPlatform(url) === "apple" ? "Apple Podcasts" : "Spotify", retry: podcast.retry };
  if (show) return { ...tab, status: "show" };

  const link = podcast.link;
  switch (link.status) {
    case "none":
    case "reading":
      return { ...tab, status: "reading", host: domainOf(url) };
    case "found":
      return { ...tab, status: "found", episode: link.episode };
    case "held":
      return { ...tab, status: "held", episode: link.episode, overviewId: link.overviewId };
    case "unreachable":
      return { ...tab, status: "unreachable" };
    case "failed": {
      if (link.reason === "not-an-episode") return { ...tab, status: "show" };
      const copy = podcastLinkFailureCopy(link.reason, link.showName);
      // The tab is the link, so there's no different one to paste; only trying again is offered.
      return { ...tab, status: "failed", copy: copy.way === "tryAgain" ? copy : { ...copy, way: null, wayLabel: null } };
    }
  }
}

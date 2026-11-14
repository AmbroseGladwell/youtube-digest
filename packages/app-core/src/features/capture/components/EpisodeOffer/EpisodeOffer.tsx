import type { PodcastEpisode } from "@overview/domain";
import { episodeFacts } from "../../../newOverview/components/PodcastLinkStatus/PodcastLinkStatus.js";
import styles from "./EpisodeOffer.module.scss";
import { episodeOfferTestIds } from "./EpisodeOfferTestIds.js";

export type EpisodeOfferState = { status: "reading"; host: string } | { status: "found"; episode: PodcastEpisode } | { status: "show" };

export interface EpisodeOfferProps {
  offer: EpisodeOfferState;
  // "Spotify" or "Apple Podcasts": the app the tab is open in.
  on: string;
}

// Design 106k: an episode tab offered as 205a offers an article, in text only. Our server reads
// the episode from the address, so the card fills in after a moment rather than straight away.
export function EpisodeOffer({ offer, on }: EpisodeOfferProps) {
  if (offer.status === "reading") {
    return (
      <section className={styles.card} aria-label="On this tab" data-testid={episodeOfferTestIds.card}>
        <p className={styles.host}>{offer.host} · Podcast</p>
        <span className={styles.bar} style={{ width: "90%" }} aria-hidden="true" />
        <span className={styles.bar} style={{ width: "60%" }} aria-hidden="true" />
        <p className={styles.finding} role="status" data-testid={episodeOfferTestIds.finding}>
          Finding the episode…
        </p>
      </section>
    );
  }
  if (offer.status === "show") {
    return (
      <section className={styles.card} aria-label="On this tab" data-testid={episodeOfferTestIds.showPage}>
        <p className={styles.kicker} data-testid={episodeOfferTestIds.kicker}>
          Podcast · on {on}
        </p>
        <h2 className={styles.title} data-testid={episodeOfferTestIds.title}>
          This is the show’s page
        </h2>
        <p className={styles.body}>Open one of its episodes, and you can make an overview of it here.</p>
      </section>
    );
  }
  const facts = episodeFacts(offer.episode);
  return (
    <section className={styles.card} aria-label="On this tab" data-testid={episodeOfferTestIds.card}>
      <p className={styles.kicker} data-testid={episodeOfferTestIds.kicker}>
        {offer.episode.showName} · Podcast · on {on}
      </p>
      <h2 className={styles.title} data-testid={episodeOfferTestIds.title}>
        {offer.episode.title}
      </h2>
      {facts !== "" && (
        <p className={styles.facts} data-testid={episodeOfferTestIds.facts}>
          {facts}
        </p>
      )}
    </section>
  );
}

import type { PodcastRead } from "@overview/domain";

// So transcribing carries on from the episode the reader saw; a read that failed is asked again.
export const rememberEpisodeRead = (
  reads: Map<string, Promise<PodcastRead>>,
  link: string,
  read: (link: string) => Promise<PodcastRead>,
): Promise<PodcastRead> => {
  const held = reads.get(link);
  if (held !== undefined) {
    return held;
  }
  const reading = read(link);
  reads.set(link, reading);
  reading.then(
    (answer) => {
      if (answer.status === "failed") {
        reads.delete(link);
      }
    },
    () => reads.delete(link),
  );
  return reading;
};

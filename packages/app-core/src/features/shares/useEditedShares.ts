import { useEffect, useState } from "react";
import { shareContentHash, shareSnapshot, type Share } from "@overview/domain";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../overviews/types/LibraryEntry.js";

// A link whose overview this device does not hold is not badged: nothing here can say it changed.
export const useEditedShares = (shares: Share[]): ReadonlySet<string> => {
  const library = useOverviewsWithStateQuery().data;
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let current = true;
    const held = new Map(readableEntries(library ?? []).map((entry) => [entry.overview.id, entry.overview]));
    void Promise.all(
      shares.map(async (share) => {
        const overview = held.get(share.overviewId);
        if (overview === undefined) {
          return null;
        }
        const { note } = shareSnapshot({ overview, narration: null });
        return (await shareContentHash(note)) === share.contentHash ? null : share.token;
      }),
    ).then((tokens) => {
      if (current) {
        setEdited(new Set(tokens.filter((token) => token !== null)));
      }
    });
    return () => {
      current = false;
    };
  }, [shares, library]);

  return edited;
};

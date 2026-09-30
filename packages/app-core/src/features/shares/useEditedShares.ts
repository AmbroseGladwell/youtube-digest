import { useEffect, useState } from "react";
import { shareContentHash, shareSnapshot, type Share } from "@overview/domain";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../overviews/types/LibraryEntry.js";

// Which of these links show a copy the reader has since edited. The same comparison the
// dialog makes, over the whole list, so Settings can badge a row without asking the server
// anything it does not already know (docs/features/sharing.md). A link whose overview this
// device does not hold is not badged: nothing here can say whether it changed.
export function useEditedShares(shares: Share[]): ReadonlySet<string> {
  const library = useOverviewsWithStateQuery().data;
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let current = true;
    const held = new Map(readableEntries(library ?? []).map((entry) => [entry.overview.id, entry.overview]));
    void Promise.all(
      shares.map(async (share) => {
        const overview = held.get(share.overviewId);
        if (overview === undefined) return null;
        const { note } = shareSnapshot({ overview, transcript: null, narration: null });
        return (await shareContentHash(note)) === share.contentHash ? null : share.token;
      }),
    ).then((tokens) => {
      if (current) setEdited(new Set(tokens.filter((token) => token !== null)));
    });
    return () => {
      current = false;
    };
  }, [shares, library]);

  return edited;
}

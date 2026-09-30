import { useEffect, useState } from "react";
import { shareContentHash, shareSnapshot, type Overview, type Share } from "@overview/domain";
import { useSharesQuery } from "./queries/sharesQuery.js";
import { useShareApi } from "./ShareApiContext.js";
import { liveShareFor } from "./util/liveShareFor.js";

export interface OverviewShare {
  // False when this shell has no account to share under: every sharing control hides.
  available: boolean;
  share: Share | null;
  // The copy behind the link was made from a different note than the one held here.
  edited: boolean;
  // Asks the server again. Called when the dialog opens, because the view count and
  // whether the copy is current are what the reader opened it to see.
  refresh: () => void;
}

// What the ⋯ menu and the dialog read. The hash is computed here rather than fetched: the
// server holds the hash of what it stored, and the reader's own copy is hashed by the same
// function, so the two can be compared without sending the overview anywhere
// (docs/features/sharing.md).
export function useOverviewShare(overview: Overview | null): OverviewShare {
  const api = useShareApi();
  const shares = useSharesQuery();
  const { refetch } = shares;
  const share = overview === null ? null : liveShareFor(shares.data, overview.id);
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    if (overview === null) {
      setHash(null);
      return;
    }
    let current = true;
    const snapshot = shareSnapshot({ overview, transcript: null, narration: null });
    void shareContentHash(snapshot.note).then((computed) => {
      if (current) setHash(computed);
    });
    return () => {
      current = false;
    };
  }, [overview]);

  return {
    available: api !== null,
    share,
    edited: share !== null && hash !== null && hash !== share.contentHash,
    refresh: () => void refetch(),
  };
}

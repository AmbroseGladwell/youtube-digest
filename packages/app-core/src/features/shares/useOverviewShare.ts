import { useEffect, useState } from "react";
import { DEFAULT_NARRATION_VOICE, shareContentHash, shareSnapshot, spokenScript, type Overview, type Share } from "@overview/domain";
import { useNarrationApi } from "../player/NarrationApiContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSharesQuery } from "./queries/sharesQuery.js";
import { useShareApi } from "./ShareApiContext.js";
import { liveShareFor } from "./util/liveShareFor.js";
import { narrationForShare } from "./util/narrationForShare.js";

export interface OverviewShare {
  // False without an account, and every sharing control hides.
  available: boolean;
  share: Share | null;
  // The shared copy was made from a different note than the one held here.
  edited: boolean;
  // The shared copy has no audio, and the reader now has some to give it.
  audioMissing: boolean;
  // Called when the dialog opens: docs/features/sharing.md, "Making and managing a link".
  refresh: () => void;
}

// Why the hash is computed here: docs/features/sharing.md, "Edited since sharing".
export const useOverviewShare = (overview: Overview | null): OverviewShare => {
  const api = useShareApi();
  const narrationApi = useNarrationApi();
  const voice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  const shares = useSharesQuery();
  const { refetch } = shares;
  const share = overview === null ? null : liveShareFor(shares.data, overview.id);
  const [hash, setHash] = useState<string | null>(null);
  const [narrationReady, setNarrationReady] = useState(false);
  const [checks, setChecks] = useState(0);
  const copyIsSilent = share !== null && !share.hasNarration;

  useEffect(() => {
    if (overview === null) {
      setHash(null);
      return;
    }
    let current = true;
    const snapshot = shareSnapshot({ overview, narration: null });
    void shareContentHash(snapshot.note).then((computed) => {
      if (current) {
        setHash(computed);
      }
    });
    return () => {
      current = false;
    };
  }, [overview]);

  useEffect(() => {
    if (overview === null || !copyIsSilent) {
      setNarrationReady(false);
      return;
    }
    let current = true;
    narrationForShare(narrationApi, spokenScript(overview), voice).then(
      (narration) => {
        if (current) {
          setNarrationReady(narration !== null);
        }
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [overview, copyIsSilent, narrationApi, voice, checks]);

  return {
    available: api !== null,
    share,
    edited: share !== null && hash !== null && hash !== share.contentHash,
    audioMissing: copyIsSilent && narrationReady,
    refresh: () => {
      void refetch();
      setChecks((count) => count + 1);
    },
  };
};

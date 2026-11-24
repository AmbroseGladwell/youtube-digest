import type { IwftTikTokPagesConfig } from "./IwftTikTokPages.testHelper.js";
import type { IwftArticlePagesConfig } from "./IwftArticlePages.testHelper.js";
import type { SignedOutTrial } from "../../src/features/signedOutTrial/types/SignedOutTrial.js";
import type { AnalyticsConsent } from "../../src/features/analyticsConsent/types/AnalyticsConsent.js";
import type {
  FollowedPlaylist,
  Overview,
  OverviewState,
  PlaylistCheck,
  Project,
  ProjectMember,
  QueuedCapture,
  Settings,
  StoredTranscript,
  SuggestedQuestion,
  Topic,
  UnreadableRecord,
  Capture,
} from "@overview/domain";
import type { AppBuild } from "../../src/app/AppBuildContext.js";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { PlaybackPosition } from "../../src/app/PlaybackContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import type { SyncConnectionInput } from "../../src/features/sync/types/SyncConnection.js";
import type { PendingSignIn } from "../../src/features/auth/types/PendingSignIn.js";
import type { InMemoryStoreRead } from "./InMemoryOverviewStore.testHelper.js";

// Plain JSON only: CT serializes hooksConfig, so index.tsx's beforeMount builds the stores from it.
export interface IwftHooksConfig {
  seedOverviews?: Overview[];
  seedStates?: OverviewState[];
  seedTopics?: Topic[];
  seedUnreadable?: UnreadableRecord[];
  seedTranscripts?: StoredTranscript[];
  seedSettings?: Partial<Settings>;
  seedFollowedPlaylists?: FollowedPlaylist[];
  seedPlaylistChecks?: PlaylistCheck[];
  seedQueue?: QueuedCapture[];
  seedCaptures?: Capture[];
  seedProjects?: Project[];
  seedProjectMembers?: ProjectMember[];
  seedSuggestedQuestions?: SuggestedQuestion[];
  failingReads?: InMemoryStoreRead[];
  apiKeys?: ApiKeys;
  syncAvailable?: boolean;
  indexedDbLibrary?: "fresh" | "kept";
  syncConnection?: SyncConnectionInput;
  pendingSignIn?: PendingSignIn;
  signedOutTrial?: SignedOutTrial;
  // Null is never asked.
  analyticsConsent?: AnalyticsConsent | null;
  accountSeen?: boolean;
  surface?: Surface;
  // Absent is desktop Chrome; false is a phone.
  desktopChrome?: boolean;
  layout?: AppLayout;
  defaultApiUrl?: string;
  serverSwitchable?: boolean;
  // Absent is a shell that was told nothing.
  build?: AppBuild;
  // Absent is a shell that can't see tabs; null is one that can, seeing no video.
  activeVideoUrl?: string | null;
  // Absent is a shell with no tabs to read, which is the web app.
  articlePages?: IwftArticlePagesConfig;
  tiktokPages?: IwftTikTokPagesConfig;
  // Absent is a shell that can't see the player; null is one that can, with nothing to report yet.
  playback?: PlaybackPosition | null;
  runBridge?: boolean;
  // The web app can't reach YouTube: a browser rule, not a setting.
  youTubeFetch?: boolean;
  errorDestinationMirror?: boolean;
  accentMirror?: boolean;
}

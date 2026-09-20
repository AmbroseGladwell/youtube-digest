import { z } from "zod";

export const InnerTubeClientConfig = z.object({
  clientName: z.string().min(1),
  clientVersion: z.string().min(1),
  userAgent: z.string().min(1),
  // Merged into context.client, for the fields a given client insists on.
  extraContext: z.record(z.string(), z.unknown()).optional(),
});

export type InnerTubeClientConfig = z.infer<typeof InnerTubeClientConfig>;

// Tried in order. WEB is absent on purpose: its caption URLs have been PO-token-gated
// since mid-2025 and come back empty, which reads as "no captions" rather than as an
// error (docs/features/transcript-retrieval.md).
export const DEFAULT_CAPTION_CLIENTS: readonly InnerTubeClientConfig[] = [
  {
    clientName: "ANDROID",
    clientVersion: "21.09.3",
    userAgent: "com.google.android.youtube/21.09.3 (Linux; U; Android 14) gzip",
    extraContext: { androidSdkVersion: 34 },
  },
  {
    clientName: "IOS",
    clientVersion: "21.09.3",
    userAgent: "com.google.ios.youtube/21.09.3 (iPhone16,2; U; CPU iOS 17_5 like Mac OS X)",
  },
];

// The mobile clients carry caption tracks but no microformat, and the web clients carry
// microformat but no caption tracks. publishedAt is the only thing this is asked for.
export const DEFAULT_METADATA_CLIENT: InnerTubeClientConfig = {
  clientName: "WEB",
  clientVersion: "2.20260306.01.00",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

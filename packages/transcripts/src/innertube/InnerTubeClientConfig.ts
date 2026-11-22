import { z } from "zod";

export const InnerTubeClientConfig = z.object({
  clientName: z.string().min(1),
  clientVersion: z.string().min(1),
  userAgent: z.string().min(1),
  extraContext: z.record(z.string(), z.unknown()).optional(),
});

export type InnerTubeClientConfig = z.infer<typeof InnerTubeClientConfig>;

// No WEB: its caption URLs are PO-token-gated and come back empty, which reads as "no captions".
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

// Only the web clients carry the microformat that holds publishedAt.
export const DEFAULT_METADATA_CLIENT: InnerTubeClientConfig = {
  clientName: "WEB",
  clientVersion: "2.20260306.01.00",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

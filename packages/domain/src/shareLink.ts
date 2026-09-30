import { z } from "zod";

// 96 bits of randomness in the path. Long enough that the only way to reach a shared copy
// is to be sent the link, short enough to read out (docs/features/sharing.md).
export const SHARE_TOKEN_BYTES = 12;

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export const ShareToken = z.string().regex(SHARE_TOKEN_PATTERN).brand("ShareToken");
export type ShareToken = z.infer<typeof ShareToken>;

export const sharePath = (token: string): string => `/s/${token}`;

export const shareUrl = (appUrl: string, token: string): string => new URL(sharePath(token), appUrl).toString();

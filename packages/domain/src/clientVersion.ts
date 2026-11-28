// Bumped only when the write floor must be able to exclude a change (docs/architecture/api.md).
export const CLIENT_VERSION = 33;

// The first client that reserves before pushing: docs/architecture/tiers.md, "Counting".
export const FIRST_RESERVING_CLIENT_VERSION = 7;

export const CLIENT_VERSION_HEADER = "x-client-version";

// Only ever logged, never trusted for a decision.
export const CLIENT_SURFACE_HEADER = "x-client-surface";

// Older clients are answered from their own overview alone (docs/features/chats.md).
export const FIRST_ACROSS_SOURCES_CLIENT_VERSION = 25;

// One number a client says about itself on the wire. Bumped deliberately when a migration
// registry moves or the contract changes in a way the write floor must be able to exclude,
// not on every release (docs/architecture/api.md).
export const CLIENT_VERSION = 1;

export const CLIENT_VERSION_HEADER = "x-client-version";

// Which shell sent a request, an AuthSurface, so the server's logs can tell the web app's
// calls from the extension's. Only ever logged, never trusted for a decision.
export const CLIENT_SURFACE_HEADER = "x-client-surface";

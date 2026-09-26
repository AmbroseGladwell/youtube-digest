// One number a client says about itself on the wire. Bumped deliberately when a migration
// registry moves or the contract changes in a way the write floor must be able to exclude,
// not on every release (docs/architecture/api.md).
export const CLIENT_VERSION = 1;

export const CLIENT_VERSION_HEADER = "x-client-version";

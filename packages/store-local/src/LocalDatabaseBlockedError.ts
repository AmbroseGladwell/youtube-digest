export class LocalDatabaseBlockedError extends Error {
  constructor(name: string) {
    super(
      `another open connection to "${name}" is holding an older version of it, so the upgrade cannot start`,
    );
  }
}

import { DATABASE_NAME } from "./localDatabaseSchema.js";

export const ACCOUNT_DATABASE_PREFIX = "overview-account-";

// The no-account library keeps the name every install already has; each account gets its
// own (docs/features/account-libraries.md).
export const localDatabaseName = (accountId: string | null): string =>
  accountId === null ? DATABASE_NAME : `${ACCOUNT_DATABASE_PREFIX}${accountId}`;

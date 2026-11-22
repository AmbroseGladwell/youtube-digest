import { DATABASE_NAME } from "./localDatabaseSchema.js";

export const ACCOUNT_DATABASE_PREFIX = "overview-account-";

// docs/features/account-libraries.md, "The decisions".
export const localDatabaseName = (accountId: string | null): string =>
  accountId === null ? DATABASE_NAME : `${ACCOUNT_DATABASE_PREFIX}${accountId}`;

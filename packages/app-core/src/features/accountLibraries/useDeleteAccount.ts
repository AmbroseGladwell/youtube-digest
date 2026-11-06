import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Routes } from "../../app/Routes.js";
import { useDeleteLibrary } from "../../stores/DeleteLibraryContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useDeleteAccountMutation } from "../auth/mutations/useDeleteAccountMutation.js";
import { useSync } from "../sync/SyncContext.js";
import { forgetAccountOnDevice } from "./forgetAccountOnDevice.js";

// The whole of deleting, once the session has proved its inbox: counted while the session
// can still carry it, asked of the server, and then this device leaves the account the way
// a sign-out does but with nothing to sync first, drops the account's library and what it
// kept about it, and goes to Start. The request's failure is the caller's to show; nothing
// on the device changes until the server has answered (docs/features/account-deletion.md).
export function useDeleteAccount(): (accountId: string) => Promise<void> {
  const sync = useSync();
  const analytics = useAnalytics();
  const errors = useErrorReporter();
  const deleteLibrary = useDeleteLibrary();
  const deleteAccount = useDeleteAccountMutation();
  const navigate = useNavigate();
  return useCallback(
    async (accountId: string) => {
      analytics.settings.sync.deleteAccountConfirmed();
      await Promise.all([analytics.flush(), errors.flush()]).catch(() => undefined);
      await deleteAccount.mutateAsync();
      sync.leaveDeletedAccount();
      await deleteLibrary?.(accountId).catch((error: unknown) => console.error(error));
      forgetAccountOnDevice(accountId);
      await navigate(Routes.home());
    },
    [sync, analytics, errors, deleteLibrary, deleteAccount, navigate],
  );
}

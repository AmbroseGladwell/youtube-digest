import { useMutation } from "@tanstack/react-query";
import type { VerificationAsked, VerificationPurpose } from "@overview/domain";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

// The purpose only changes what the mail says; left out, it is the email change's
// (docs/features/account-deletion.md).
export const useRequestVerificationMutation = () => {
  const api = useSessionAuthApi();
  return useMutation<VerificationAsked, Error, VerificationPurpose | void>({
    mutationFn: (purpose) => api!.requestVerification(purpose ?? "emailChange"),
  });
};

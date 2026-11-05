import { useMutation } from "@tanstack/react-query";
import type { VerificationAsked } from "@overview/domain";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

export const useRequestVerificationMutation = () => {
  const api = useSessionAuthApi();
  return useMutation<VerificationAsked, Error, void>({
    mutationFn: () => api!.requestVerification(),
  });
};

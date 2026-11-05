import { useMutation } from "@tanstack/react-query";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

export const useConfirmVerificationMutation = () => {
  const api = useSessionAuthApi();
  return useMutation<void, Error, string>({
    mutationFn: (code) => api!.confirmVerification(code),
  });
};

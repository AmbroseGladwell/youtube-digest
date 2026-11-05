import { useMutation } from "@tanstack/react-query";
import type { EmailChangeAsked } from "@overview/domain";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

export const useRequestEmailChangeMutation = () => {
  const api = useSessionAuthApi();
  return useMutation<EmailChangeAsked, Error, string>({
    mutationFn: (email) => api!.requestEmailChange(email),
  });
};

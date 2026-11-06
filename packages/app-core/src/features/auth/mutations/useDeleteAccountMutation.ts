import { useMutation } from "@tanstack/react-query";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

export const useDeleteAccountMutation = () => {
  const api = useSessionAuthApi();
  return useMutation<void, Error, void>({
    mutationFn: () => api!.deleteAccount(),
  });
};

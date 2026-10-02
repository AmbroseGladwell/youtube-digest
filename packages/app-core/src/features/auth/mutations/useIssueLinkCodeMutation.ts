import { useMutation } from "@tanstack/react-query";
import type { LinkCode } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";

export interface IssueLinkCodeVariables {
  apiUrl: string;
}

export const useIssueLinkCodeMutation = (
  createApi?: (baseUrl: string) => AuthApi,
) => {
  const surface = useClientSurface();
  const api = createApi ?? ((baseUrl: string) => createFetchAuthApi({ baseUrl, surface }));
  return useMutation<LinkCode, Error, IssueLinkCodeVariables>({
    mutationFn: ({ apiUrl }) => api(apiUrl).issueLinkCode(),
  });
};

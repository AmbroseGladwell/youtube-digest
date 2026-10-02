import { useMutation } from "@tanstack/react-query";
import type { MagicLinkRequest } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";

export interface RequestMagicLinkVariables {
  apiUrl: string;
  request: MagicLinkRequest;
}

export const useRequestMagicLinkMutation = (
  createApi?: (baseUrl: string) => AuthApi,
) => {
  const surface = useClientSurface();
  const api = createApi ?? ((baseUrl: string) => createFetchAuthApi({ baseUrl, surface }));
  return useMutation<void, Error, RequestMagicLinkVariables>({
    mutationFn: ({ apiUrl, request }) => api(apiUrl).requestMagicLink(request),
  });
};

import { useMutation } from "@tanstack/react-query";
import type { MagicLinkRequest } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";

export interface RequestMagicLinkVariables {
  apiUrl: string;
  request: MagicLinkRequest;
}

export const useRequestMagicLinkMutation = (
  createApi: (baseUrl: string) => AuthApi = (baseUrl) => createFetchAuthApi({ baseUrl }),
) =>
  useMutation<void, Error, RequestMagicLinkVariables>({
    mutationFn: ({ apiUrl, request }) => createApi(apiUrl).requestMagicLink(request),
  });

import { useMutation } from "@tanstack/react-query";
import type { AuthSurface } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";

export interface RequestMagicLinkVariables {
  apiUrl: string;
  email: string;
  surface: AuthSurface;
}

export const useRequestMagicLinkMutation = (
  createApi: (baseUrl: string) => AuthApi = (baseUrl) => createFetchAuthApi({ baseUrl }),
) =>
  useMutation<void, Error, RequestMagicLinkVariables>({
    mutationFn: ({ apiUrl, email, surface }) => createApi(apiUrl).requestMagicLink(email, surface),
  });

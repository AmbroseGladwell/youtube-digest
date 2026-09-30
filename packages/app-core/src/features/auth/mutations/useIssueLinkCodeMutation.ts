import { useMutation } from "@tanstack/react-query";
import type { LinkCode } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";

export interface IssueLinkCodeVariables {
  apiUrl: string;
}

export const useIssueLinkCodeMutation = (
  createApi: (baseUrl: string) => AuthApi = (baseUrl) => createFetchAuthApi({ baseUrl }),
) =>
  useMutation<LinkCode, Error, IssueLinkCodeVariables>({
    mutationFn: ({ apiUrl }) => createApi(apiUrl).issueLinkCode(),
  });

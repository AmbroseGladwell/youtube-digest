import { useMutation } from "@tanstack/react-query";
import type { LinkedSession } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";

export interface ExchangeLinkCodeVariables {
  apiUrl: string;
  code: string;
}

export const useExchangeLinkCodeMutation = (
  createApi: (baseUrl: string) => AuthApi = (baseUrl) => createFetchAuthApi({ baseUrl }),
) =>
  useMutation<LinkedSession, Error, ExchangeLinkCodeVariables>({
    mutationFn: ({ apiUrl, code }) => createApi(apiUrl).exchangeLinkCode(code),
  });

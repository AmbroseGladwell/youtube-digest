import { useMutation } from "@tanstack/react-query";
import type { LinkedSession } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";

export interface ExchangeLinkCodeVariables {
  apiUrl: string;
  code: string;
}

export const useExchangeLinkCodeMutation = (
  createApi?: (baseUrl: string) => AuthApi,
) => {
  const surface = useClientSurface();
  const api = createApi ?? ((baseUrl: string) => createFetchAuthApi({ baseUrl, surface }));
  return useMutation<LinkedSession, Error, ExchangeLinkCodeVariables>({
    mutationFn: ({ apiUrl, code }) => api(apiUrl).exchangeLinkCode(code),
  });
};

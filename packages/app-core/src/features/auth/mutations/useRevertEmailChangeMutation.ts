import { useMutation } from "@tanstack/react-query";
import type { EmailChangeReverted } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";

export interface RevertEmailChangeVariables {
  apiUrl: string;
  token: string;
}

// Public, like signing in by a link: the page that the mail's button opens holds no
// session, and every session is about to end anyway (docs/features/account-changes.md).
export const useRevertEmailChangeMutation = (createApi?: (baseUrl: string) => AuthApi) => {
  const surface = useClientSurface();
  const api = createApi ?? ((baseUrl: string) => createFetchAuthApi({ baseUrl, surface }));
  return useMutation<EmailChangeReverted, Error, RevertEmailChangeVariables>({
    mutationFn: ({ apiUrl, token }) => api(apiUrl).revertEmailChange(token),
  });
};

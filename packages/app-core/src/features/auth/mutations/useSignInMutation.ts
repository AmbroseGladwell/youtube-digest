import { useMutation } from "@tanstack/react-query";
import type { SignedIn } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";

export interface SignInVariables {
  apiUrl: string;
  token: string;
}

export const useSignInMutation = (
  createApi?: (baseUrl: string) => AuthApi,
) => {
  const surface = useClientSurface();
  const api = createApi ?? ((baseUrl: string) => createFetchAuthApi({ baseUrl, surface }));
  return useMutation<SignedIn, Error, SignInVariables>({
    mutationFn: ({ apiUrl, token }) => api(apiUrl).signIn(token),
  });
};

import { useMutation } from "@tanstack/react-query";
import type { SignedIn } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";

export interface SignInWithEmailCodeVariables {
  apiUrl: string;
  email: string;
  code: string;
}

export const useSignInWithEmailCodeMutation = (
  createApi?: (baseUrl: string) => AuthApi,
) => {
  const surface = useClientSurface();
  const api = createApi ?? ((baseUrl: string) => createFetchAuthApi({ baseUrl, surface }));
  return useMutation<SignedIn, Error, SignInWithEmailCodeVariables>({
    mutationFn: ({ apiUrl, email, code }) => api(apiUrl).signInWithEmailCode(email, code),
  });
};

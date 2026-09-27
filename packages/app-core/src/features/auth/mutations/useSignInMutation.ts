import { useMutation } from "@tanstack/react-query";
import type { SignedIn } from "@overview/domain";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";

export interface SignInVariables {
  apiUrl: string;
  token: string;
}

export const useSignInMutation = (
  createApi: (baseUrl: string) => AuthApi = (baseUrl) => createFetchAuthApi({ baseUrl }),
) =>
  useMutation<SignedIn, Error, SignInVariables>({
    mutationFn: ({ apiUrl, token }) => createApi(apiUrl).signIn(token),
  });

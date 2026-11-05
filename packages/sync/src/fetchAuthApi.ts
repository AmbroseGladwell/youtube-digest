import { z } from "zod";
import {
  EmailChangeAsked,
  EmailChangeReverted,
  LinkCode,
  LinkedSession,
  SessionInfo,
  SignedIn,
  VerificationAsked,
} from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { AuthApi } from "./AuthApi.js";

export type FetchAuthApiOptions = ApiRequesterOptions;

const Accepted = z.object({ accepted: z.literal(true) });

export function createFetchAuthApi(options: FetchAuthApiOptions): AuthApi {
  const request = createApiRequester(options);

  return {
    requestMagicLink: async (body) => {
      await answered(request("POST", "/auth/magic-link", Accepted, { body }));
    },
    signIn: (token) => answered(request("POST", "/auth/sign-in", SignedIn, { body: { token } })),
    signInWithEmailCode: (email, code) =>
      answered(request("POST", "/auth/email-code", SignedIn, { body: { email, code } })),
    exchangeLinkCode: (code) => answered(request("POST", "/auth/link-code", LinkedSession, { body: { code } })),
    session: () => answered(request("GET", "/session", SessionInfo)),
    issueLinkCode: () => answered(request("POST", "/session/link-code", LinkCode)),
    signOut: async () => {
      await request("DELETE", "/session", z.never());
    },
    updateAccount: (update) => answered(request("PUT", "/session/account", SessionInfo, { body: update })),
    requestVerification: () => answered(request("POST", "/session/verification", VerificationAsked)),
    confirmVerification: async (code) => {
      await request("POST", "/session/verification/confirm", z.never(), { body: { code } });
    },
    requestEmailChange: (email) =>
      answered(request("POST", "/session/email-change", EmailChangeAsked, { body: { email } })),
    confirmEmailChange: (code) =>
      answered(request("POST", "/session/email-change/confirm", SessionInfo, { body: { code } })),
    revertEmailChange: (token) =>
      answered(request("POST", "/auth/email-change/revert", EmailChangeReverted, { body: { token } })),
  };
}

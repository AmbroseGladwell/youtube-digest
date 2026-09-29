import { z } from "zod";
import { LinkedSession, SessionInfo, SignedIn } from "@overview/domain";
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
    exchangeLinkCode: (code) => answered(request("POST", "/auth/link-code", LinkedSession, { body: { code } })),
    session: () => answered(request("GET", "/session", SessionInfo)),
    signOut: async () => {
      await request("DELETE", "/session", z.never());
    },
  };
}

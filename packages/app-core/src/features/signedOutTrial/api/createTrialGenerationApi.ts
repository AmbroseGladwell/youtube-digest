import { createFetchGenerationApi, isSyncRequestError, type ApiRequesterOptions, type GenerationApi } from "@overview/sync";
import { currentSignedOutTrial, forgetTrialToken, rememberTrialToken } from "../useSignedOutTrial.js";

const isUnknownTrial = (error: unknown): boolean =>
  isSyncRequestError(error) && error.code === "unauthenticated" && error.details?.trial === "unknown";

// Signed out, our key through this device's trial: its token is asked for before the first
// overview on ours and kept, and asked for again when the server no longer knows it
// (docs/architecture/tiers.md, "Counting").
export function createTrialGenerationApi(options: Omit<ApiRequesterOptions, "token" | "trialToken">): Pick<GenerationApi, "generate"> {
  const tokenNow = async (): Promise<string> => {
    const held = currentSignedOutTrial().token;
    if (held !== null) return held;
    const { token } = await createFetchGenerationApi(options).startTrial();
    rememberTrialToken(token);
    return token;
  };
  const generateWith = async (request: Parameters<GenerationApi["generate"]>[0]) =>
    createFetchGenerationApi({ ...options, trialToken: await tokenNow() }).generate(request);

  return {
    generate: async (request) => {
      try {
        return await generateWith(request);
      } catch (error) {
        if (!isUnknownTrial(error)) throw error;
        forgetTrialToken();
        return generateWith(request);
      }
    },
  };
}

import { createFetchGenerationApi, isSyncRequestError, type ApiRequesterOptions } from "@overview/sync";
import { currentSignedOutTrial, forgetTrialToken, rememberTrialToken } from "../useSignedOutTrial.js";

const isUnknownTrial = (error: unknown): boolean =>
  isSyncRequestError(error) && error.code === "unauthenticated" && error.details?.trial === "unknown";

// Signed out, a call made on this device's trial: its token is asked for before the first such
// call and kept, and asked for again when the server no longer knows it
// (docs/architecture/tiers.md, "Counting").
export async function withTrialToken<T>(
  options: Omit<ApiRequesterOptions, "token" | "trialToken">,
  call: (trialToken: string) => Promise<T>,
): Promise<T> {
  const tokenNow = async (): Promise<string> => {
    const held = currentSignedOutTrial().token;
    if (held !== null) return held;
    const { token } = await createFetchGenerationApi(options).startTrial();
    rememberTrialToken(token);
    return token;
  };
  try {
    return await call(await tokenNow());
  } catch (error) {
    if (!isUnknownTrial(error)) throw error;
    forgetTrialToken();
    return call(await tokenNow());
  }
}

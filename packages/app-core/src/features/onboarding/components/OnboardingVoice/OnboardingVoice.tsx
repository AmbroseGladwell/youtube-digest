import { useMemo } from "react";
import { createFetchNarrationApi } from "@overview/sync";
import { useClientSurface } from "../../../../app/SurfaceContext.js";
import { NarrationApiProvider, useNarrationApi } from "../../../player/NarrationApiContext.js";
import { NarrationVoicePicker } from "../../../settings/components/NarrationVoicePicker/NarrationVoicePicker.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import { ONBOARDING_HEADING_ID, OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingVoice.module.scss";
import { onboardingVoiceTestIds } from "./OnboardingVoiceTestIds.js";

// Design 46g: the 43a picker as it is, Heart already chosen. The choice is saved now and the
// audio is recorded once there is an account to narrate for. Signed out the picker has no
// narration to ask, so it is handed one that only plays the samples, which are public
// (docs/features/narration-voice.md, "Signed out").
export function OnboardingVoice({ onContinue }: { onContinue: () => void }) {
  const accountApi = useNarrationApi();
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  const samplesApi = useMemo(
    () => accountApi ?? (apiUrl === null ? null : createFetchNarrationApi({ baseUrl: apiUrl, token: null, surface })),
    [accountApi, apiUrl, surface],
  );

  return (
    <div className={styles.root} data-testid={onboardingVoiceTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Who should read your overviews?</OnboardingHeading>
        <p className={styles.lead}>
          Tap a voice to have a listen. We'll use it on all your devices, and you can change it any time.
        </p>
      </div>
      <NarrationApiProvider value={samplesApi}>
        <NarrationVoicePicker labelledBy={ONBOARDING_HEADING_ID} />
      </NarrationApiProvider>
      <div className={styles.foot}>
        <button type="button" className={styles.primary} onClick={onContinue} data-testid={onboardingVoiceTestIds.continue}>
          Continue
        </button>
      </div>
    </div>
  );
}

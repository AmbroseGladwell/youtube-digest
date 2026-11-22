import { Navigate } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { useAccountNeeded } from "../../accountLibraries/useAccountNeeded.js";
import { readOnboardingProgress } from "../../onboarding/onboardingProgressStorage.js";
import { startAsked } from "../../onboarding/startAsked.js";
import { RequestLinkFlow } from "../components/RequestLinkFlow/RequestLinkFlow.js";

// Why every Create account goes to Start: docs/features/onboarding.md, "Every Create account".
export const CreateAccountPage = () => {
  const accountNeeded = useAccountNeeded();
  if (!accountNeeded) {
    return <RequestLinkFlow intent="createAccount" />;
  }
  if (readOnboardingProgress() !== null) {
    return <Navigate to={Routes.onboarding()} replace />;
  }
  return <Navigate to={Routes.home()} replace state={startAsked} />;
};

import { Navigate } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { useAccountNeeded } from "../../accountLibraries/useAccountNeeded.js";
import { readOnboardingProgress } from "../../onboarding/onboardingProgressStorage.js";
import { startAsked } from "../../onboarding/startAsked.js";
import { RequestLinkFlow } from "../components/RequestLinkFlow/RequestLinkFlow.js";

// Where there are accounts, no new one skips onboarding: every Create account goes to Start, or
// back to onboarding already under way, whose account screen holds the form. Start is home's,
// asked for even in a panel whose home leads with signing back in. A shell with no server
// keeps design 9b's own page (docs/features/onboarding.md, "Every Create account").
export function CreateAccountPage() {
  const accountNeeded = useAccountNeeded();
  if (!accountNeeded) return <RequestLinkFlow intent="createAccount" />;
  if (readOnboardingProgress() !== null) return <Navigate to={Routes.onboarding()} replace />;
  return <Navigate to={Routes.home()} replace state={startAsked} />;
}

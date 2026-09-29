import { RequestLinkFlow } from "../components/RequestLinkFlow/RequestLinkFlow.js";

// Design 9b: its own page, with a first name, sending the same kind of link marked as a
// sign-up (docs/features/sign-in.md, "Creating an account").
export function CreateAccountPage() {
  return <RequestLinkFlow intent="createAccount" />;
}

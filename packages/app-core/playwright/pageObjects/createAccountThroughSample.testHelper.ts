import { sampleDeckTestIds } from "../../src/features/onboarding/components/SampleDeck/SampleDeckTestIds.js";
import { sampleRowTestIds } from "../../src/features/onboarding/components/SampleRow/SampleRowTestIds.js";
import type { TestContext } from "../support/TestContext.testHelper.js";
import { OnboardingPageObject } from "./OnboardingPageObject.testHelper.js";
import type { SignInPageObject } from "./SignInPageObject.testHelper.js";

// Every Create account goes through onboarding, and a sample is the quickest way to its account
// screen: from Start, the deck's front card on the web or the first row in the panel, then
// through the screens (docs/features/onboarding.md, "Every Create account").
export async function createAccountThroughSample(testContext: TestContext): Promise<SignInPageObject> {
  const { page } = testContext;
  const front = page.locator(`[data-testid="${sampleDeckTestIds.card}"][data-front]`);
  await front.or(page.getByTestId(sampleRowTestIds.root).first()).click();
  const onboarding = await new OnboardingPageObject(testContext).verifyIsShown();
  await onboarding.skipToAccount();
  return (await onboarding.continueWithEmail()).verifyAsksForEmail("Create your account");
}

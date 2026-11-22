import { sampleDeckTestIds } from "../../src/features/onboarding/components/SampleDeck/SampleDeckTestIds.js";
import { sampleRowTestIds } from "../../src/features/onboarding/components/SampleRow/SampleRowTestIds.js";
import type { TestContext } from "../support/TestContext.testHelper.js";
import { OnboardingPageObject } from "./OnboardingPageObject.testHelper.js";
import type { SignInPageObject } from "./SignInPageObject.testHelper.js";

export const createAccountThroughSample = async (testContext: TestContext): Promise<SignInPageObject> => {
  const { page } = testContext;
  const front = page.locator(`[data-testid="${sampleDeckTestIds.card}"][data-front]`);
  await front.or(page.getByTestId(sampleRowTestIds.root).first()).click();
  const onboarding = await new OnboardingPageObject(testContext).verifyIsShown();
  await onboarding.skipToAccount();
  return onboarding.accountForm.verifyAsksForEmail("Create your free account to get your overview.");
};

import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";

const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

async function toTheReveal(launcher: Launcher, { sentence }: { sentence: boolean }) {
  const home = await launcher.launch({ sync: true });
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  if (sentence) {
    await onboarding.sentence.fill("who", "dad", "husband");
    await onboarding.continueFromAboutYou();
  } else {
    await onboarding.skip();
  }
  await onboarding.skip();
  await onboarding.seeOverview();
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");
  await onboarding.continueWithFree();
  return launcher.readerPage.verifyIsShown();
}

test("the reveal flips How to apply to the version for anyone and back, by mouse and by arrow key", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.writesHowToApply(["Dice a week of onions on Sunday."]);
  await toTheReveal(launcher, { sentence: true });

  await launcher.howToApplyFlip.verifyReady();
  await launcher.howToApplyFlip.verifyLineReads("Written for you: a dad and a husband.");

  await launcher.howToApplyFlip.chooseForAnyone();

  await launcher.howToApplyFlip.verifyStepsRead("Practise the claw grip on one onion a day.");
  await launcher.howToApplyFlip.verifyLineReads("The general version. Switch back to see the steps written for you.");

  await launcher.howToApplyFlip.chooseForYouWithArrowKey();

  await launcher.howToApplyFlip.verifyNoteStepsShown();
  await launcher.howToApplyFlip.verifyLineReads("Written for you: a dad and a husband.");
  expect(backendSimulator.getCallCount(EndpointKey.FOR_ANYONE)).toBe(1);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "onboarding.writtenForYou.flipped"))
    .toEqual([
      { name: "onboarding.writtenForYou.flipped", props: { to: "anyone" } },
      { name: "onboarding.writtenForYou.flipped", props: { to: "you" } },
    ]);
});

test("while For anyone is written its option says so and can't be chosen", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.writesHowToApply(["Dice a week of onions on Sunday."]);
  backendSimulator.simulateEndpointStalled(EndpointKey.FOR_ANYONE);
  await toTheReveal(launcher, { sentence: true });

  await launcher.howToApplyFlip.verifyWriting();
  await launcher.howToApplyFlip.verifyNoteStepsShown();
});

test("if For anyone can't be written the control quietly goes", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.writesHowToApply(["Dice a week of onions on Sunday."]);
  backendSimulator.simulateEndpointError(EndpointKey.FOR_ANYONE);
  await toTheReveal(launcher, { sentence: true });

  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.FOR_ANYONE)).toBe(1);
  await launcher.howToApplyFlip.verifyIsAbsent();
});

test("with nothing known about the reader there is nothing to flip", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.writesHowToApply(["Dice a week of onions on Sunday."]);
  await toTheReveal(launcher, { sentence: false });

  await launcher.howToApplyFlip.verifyIsAbsent();
  expect(backendSimulator.getCallCount(EndpointKey.FOR_ANYONE)).toBe(0);
});

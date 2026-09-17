import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";

test("an empty library shows the first-run hero, not the filter/library chrome", async ({ launcher }) => {
  const home = await launcher.launch();
  await home.verifyShowsFirstRunHero();
});

test("with no keys saved, the url input stays disabled behind the keys panel", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();
});

test("with keys already saved, the generate form is usable immediately, no keys panel", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" },
  });
  await form.verifyIsShown();
  await form.verifyGenerateButtonEnabled();
});

test("submitting a non-YouTube URL shows a validation error and makes no network calls", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" },
  });

  await form.submitUrl("https://vimeo.com/12345");
  await form.verifyValidationError("That doesn't look like a YouTube URL.");

  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_METADATA)).toBe(0);
});

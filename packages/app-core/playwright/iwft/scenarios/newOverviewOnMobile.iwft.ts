import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
const PHONE = { width: 390, height: 780 };

test("on a phone the paste field sits behind + New, and opens from it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);

  await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });
  const form = launcher.appShell.generateForm;
  await form.verifyIsHidden();

  await launcher.appShell.clickNewOverview();
  await form.verifyUrlInputVisible();
});

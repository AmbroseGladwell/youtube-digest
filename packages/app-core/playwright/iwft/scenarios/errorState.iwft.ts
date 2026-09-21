import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("a library that cannot be read says so, rather than looking empty", async ({ launcher }) => {
  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["overviews"] });

  await deadEnd.verifyTitleReads("Couldn't load your library");
  await deadEnd.verifyOffersAction("Try again");
});

test("topics that cannot be read say so, rather than emptying the rail in silence", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());

  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["topics"] });

  await deadEnd.verifyTitleReads("Couldn't load your topics");
  await deadEnd.verifyOffersAction("Try again");
});

test("a dead end offers only the way out its own case has, never a fixed pair", async ({
  launcher,
}) => {
  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["overviews"] });

  await deadEnd.verifyOffersNoWayBack();
});

test("a case with nothing to add renders no body, rather than padding one out", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());

  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["topics"] });

  await deadEnd.verifyHasNoBody();
});

test("the way out takes focus, so a keyboard lands on it rather than at the top", async ({
  launcher,
}) => {
  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["overviews"] });

  await deadEnd.verifyActionHasFocus();
});

test("trying again re-reads the library, and shows it once the read succeeds", async ({
  launcher,
}) => {
  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["overviews"] });

  await launcher.stopFailing("overviews");
  await deadEnd.takeAction();

  await deadEnd.verifyIsGone();
});

import { expect, test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { playerScrubberTestIds } from "../../../src/features/player/components/PlayerScrubber/PlayerScrubberTestIds.js";
import { readerPlayerBarTestIds } from "../../../src/features/reader/components/ReaderPlayerBar/ReaderPlayerBarTestIds.js";

const SHOTS = process.env.IWFT_SHOTS;

const NOTE = makeOverview({
  inOneLine: "Three grids are costing reactors back in.",
  coreClaim: "Capacity prices, not construction costs, drive the reversal.",
  keyPoints: [
    { text: "Capacity-market clearing prices drive the reversal.", range: null },
    { text: "Two of the three grids have signed long contracts.", range: null },
    { text: "Construction costs have not fallen.", range: null },
    { text: "Storage is not yet cheap enough to compete.", range: null },
  ],
  howToApply: { items: ["Check your own grid's capacity auction."] },
  watchAnyway: { answer: "no", reason: "A written note carries it.", range: null },
});

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

const SIZES = { web: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;

// Frames 42a to 42f of OV-42 Playing While It Renders, walked in order; docs/features/audio-player.md, "Playing while it renders".
for (const [size, viewport] of Object.entries(SIZES)) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`narration plays while it renders, ${size}, ${colorScheme}`, async ({ page, launcher, backendSimulator }) => {
      const shot = async (frame: string) => {
        if (SHOTS) {
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.mouse.move(0, 0);
          await page.screenshot({ path: `${SHOTS}/${frame}-${size}-${colorScheme}.png` });
        }
      };
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      backendSimulator.overviews.seed(NOTE);
      const library = await launcher.launchExpectingLibrary(SIGNED_IN);
      const reader = await library.nthCard(0).openReader();

      await reader.clickPlayPause();
      await reader.verifyBarSays("Starting");
      await reader.verifyPlayButtonReads("Pause, starting");
      await reader.verifySkipIsEnabled(false);
      await shot("42a");

      backendSimulator.narration.streamRenders(4);
      await reader.verifyBarSays(/^Now playing · /);
      await expect(page.getByTestId(playerScrubberTestIds.made)).toBeVisible();
      await reader.verifyBarClockReads(/^\d:\d\d · ~\d+ min$/);
      await shot("42b");

      await reader.pressOnScrubber("End");
      await reader.verifyBarSays(/^Preparing from /);
      await expect(page.getByTestId(readerPlayerBarTestIds.backButton)).toHaveText(/^Back to \d:\d\d$/);
      await expect(page.getByTestId(playerScrubberTestIds.gap)).toBeVisible();
      await shot("42d");

      await page.getByTestId(readerPlayerBarTestIds.backButton).click();
      await reader.verifyBarSays(/^Now playing · /);
      await expect(page.getByTestId(readerPlayerBarTestIds.backButton)).toHaveCount(0);

      backendSimulator.narration.finishRenders();
      await reader.verifyBarClockReads(/^\d:\d\d · −\d:\d\d$/);
      await expect(page.getByTestId(playerScrubberTestIds.made)).toHaveCount(0);
      await shot("42e");

      await reader.clickBackToLibrary();
      await launcher.miniPlayer.verifyIsShown(true);
      await shot("42f");
    });
  }
}

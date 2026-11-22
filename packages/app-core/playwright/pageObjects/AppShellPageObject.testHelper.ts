import { expect } from "@playwright/experimental-ct-react";
import type { NavigationDirection } from "../../src/util/viewTransitions.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { accountMenuTestIds } from "../../src/features/auth/components/AccountMenu/AccountMenuTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { AccountMenuPageObject } from "./AccountMenuPageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { GenerationStatusStripPageObject } from "./GenerationStatusStripPageObject.testHelper.js";
import { NewOverviewDialogPageObject } from "./NewOverviewDialogPageObject.testHelper.js";
import { ProjectsIndexPageObject } from "./ProjectsIndexPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";
import { StaleClientBannerPageObject } from "./StaleClientBannerPageObject.testHelper.js";
import { ErrorStatePageObject } from "./ErrorStatePageObject.testHelper.js";
import { CaptureQueueStripPageObject } from "./CaptureQueueStripPageObject.testHelper.js";
import { PlaylistFollowFlowPageObject } from "./PlaylistFollowFlowPageObject.testHelper.js";
import { QueuePageObject } from "./QueuePageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";
import { AskPagePageObject } from "./AskPagePageObject.testHelper.js";

const OVERVIEW_IMAGE_GROUP = "::view-transition-group(overview-image)";

// Each entry the recorder keeps is "<pseudo-element>|<keyframes name>".
const pseudoOf = (entry: string) => entry.slice(0, entry.indexOf("|"));
const keyframesOf = (entry: string) => entry.slice(entry.indexOf("|") + 1);

export class AppShellPageObject extends PageObject {
  get accountMenu(): AccountMenuPageObject {
    return new AccountMenuPageObject(this.testContext, this.get(appShellTestIds.masthead));
  }

  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  get newOverviewDialog(): NewOverviewDialogPageObject {
    return new NewOverviewDialogPageObject(this.testContext);
  }

  get generationStatusStrip(): GenerationStatusStripPageObject {
    return new GenerationStatusStripPageObject(this.testContext);
  }

  get queueStrip(): CaptureQueueStripPageObject {
    return new CaptureQueueStripPageObject(this.testContext);
  }

  get playlistFlow(): PlaylistFollowFlowPageObject {
    return new PlaylistFollowFlowPageObject(this.testContext);
  }

  get queuePage(): QueuePageObject {
    return new QueuePageObject(this.testContext);
  }

  get staleClientBanner(): StaleClientBannerPageObject {
    return new StaleClientBannerPageObject(this.testContext);
  }

  get writeFloorWall(): ErrorStatePageObject {
    return new ErrorStatePageObject(this.testContext, this.get(appShellTestIds.pane));
  }

  verifyBarFitsTheScreen = () =>
    this.step("verifyBarFitsTheScreen", async () => {
      const width = this.page.viewportSize()!.width;
      const controls = this.get(appShellTestIds.masthead).locator(
        `[data-testid="${appShellTestIds.askButton}"], [data-testid="${appShellTestIds.newOverviewButton}"], [data-testid="${accountMenuTestIds.trigger}"]`,
      );
      await expect(controls.first()).toBeVisible();
      for (const box of await controls.evaluateAll((all) => all.map((control) => control.getBoundingClientRect().toJSON() as DOMRect))) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      await this.verifyPageDoesNotScrollSideways();
    });

  verifyNameShownWhole = () =>
    this.step("verifyNameShownWhole", async () => {
      const name = this.get(appShellTestIds.brand).locator("h1");
      await expect(name).toHaveText("The Overview");
      expect(await name.evaluate((title) => title.scrollWidth - title.clientWidth)).toBeLessThanOrEqual(0);
    });

  verifyBackLabelShownWhole = (label: string) =>
    this.step(`verifyBackLabelShownWhole ${label}`, async () => {
      const back = this.get(appShellTestIds.backLink);
      await expect(back).toHaveText(label);
      const spill = await back.evaluate((link) => {
        const words = link.lastElementChild!.getBoundingClientRect();
        return words.right - link.getBoundingClientRect().right;
      });
      expect(spill).toBeLessThanOrEqual(0.5);
    });

  // paneTransitions.scss keys every rule off this attribute, so it is what can be asserted.
  verifyNavigationDirection = (direction: NavigationDirection) =>
    this.step(`verifyNavigationDirection ${direction}`, () =>
      expect(this.page.locator("html")).toHaveAttribute("data-nav-direction", direction),
    );

  // Recorded, not polled: docs/features/page-transitions.md, "How it's tested".
  verifyNavigationAnimates = <T>(go: () => Promise<T>): Promise<T> =>
    this.step("verifyNavigationAnimates", async () => {
      const arrived = await this.whileRecordingTransitions(go);
      expect(arrived.opened).toBeGreaterThan(0);
      return arrived.result;
    });

  verifyNavigationDoesNotAnimate = <T>(go: () => Promise<T>): Promise<T> =>
    this.step("verifyNavigationDoesNotAnimate", async () => {
      const arrived = await this.whileRecordingTransitions(go);
      expect(arrived.opened).toBe(0);
      return arrived.result;
    });

  verifyImageCarriesAcross = <T>(go: () => Promise<T>): Promise<T> =>
    this.step("verifyImageCarriesAcross", async () => {
      const arrived = await this.whileRecordingTransitions(go);
      expect(arrived.seen.map(pseudoOf)).toContain(OVERVIEW_IMAGE_GROUP);
      return arrived.result;
    });

  // The pane's own transition still runs, so this asks for the image's group alone.
  verifyImageDoesNotCarryAcross = <T>(go: () => Promise<T>): Promise<T> =>
    this.step("verifyImageDoesNotCarryAcross", async () => {
      const arrived = await this.whileRecordingTransitions(go);
      expect(arrived.seen.map(pseudoOf)).not.toContain(OVERVIEW_IMAGE_GROUP);
      return arrived.result;
    });

  // Which keyframes play is the only place the dropped slide shows.
  verifyThePaneKeyframesAre = <T>(wanted: string, go: () => Promise<T>): Promise<T> =>
    this.step(`verifyThePaneKeyframesAre ${wanted}`, async () => {
      const arrived = await this.whileRecordingTransitions(go);
      const paneEntries = arrived.seen.filter((entry) => pseudoOf(entry) === "::view-transition-new(pane)");
      expect(paneEntries.map(keyframesOf)).toEqual([wanted]);
      return arrived.result;
    });

  private verifyNoTransitionIsRunning = () =>
    expect
      .poll(
        () =>
          this.page.evaluate(() =>
            document.getAnimations().some((animation) => {
              const effect = animation.effect;
              return effect instanceof KeyframeEffect && (effect.pseudoElement ?? "").startsWith("::view-transition");
            }),
          ),
        { timeout: 4_000 },
      )
      .toBe(false);

  // Counted, then read at ready: docs/features/page-transitions.md, "How it's tested".
  private whileRecordingTransitions = async <T>(go: () => Promise<T>): Promise<{ result: T; seen: string[]; opened: number }> => {
    // A transition still running is skipped by the next and never reaches ready, so wait for quiet.
    await this.verifyNoTransitionIsRunning();
    await this.page.evaluate(() => {
      const seen: string[] = [];
      const opened = { count: 0 };
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = ((callback: () => void | Promise<void>) => {
        opened.count += 1;
        const transition = original(callback);
        void transition.ready.then(
          () => {
            for (const animation of document.getAnimations()) {
              const effect = animation.effect;
              if (effect instanceof KeyframeEffect && Boolean(effect.pseudoElement)) {
                seen.push(`${effect.pseudoElement!}|${(animation as CSSAnimation).animationName}`);
              }
            }
          },
          () => undefined,
        );
        return transition;
      }) as typeof document.startViewTransition;
      Object.assign(globalThis, {
        __transitionsSeen: seen,
        __transitionsOpened: opened,
        __transitionsStop: () => {
          document.startViewTransition = original;
        },
      });
    });
    const result = await go();
    const taken = await this.page.evaluate(() => {
      const held = globalThis as {
        __transitionsSeen?: string[];
        __transitionsOpened?: { count: number };
        __transitionsStop?: () => void;
      };
      held.__transitionsStop?.();
      const recorded = held.__transitionsSeen ?? [];
      const opened = held.__transitionsOpened?.count ?? 0;
      Object.assign(globalThis, {
        __transitionsSeen: undefined,
        __transitionsOpened: undefined,
        __transitionsStop: undefined,
      });
      return { seen: [...new Set(recorded)].filter((entry) => entry.startsWith("::view-transition")), opened };
    });
    return { result, seen: taken.seen, opened: taken.opened };
  };

  verifyIsParedBackToThePanel = () =>
    this.step("verifyIsParedBackToThePanel", async () => {
      await this.expectToBeVisible(appShellTestIds.brand);
      await expect(this.page.getByRole("button", { name: "Account" })).toBeVisible();
      await this.expectToBeVisible(appShellTestIds.newOverviewButton);
      await expect(this.page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    });

  verifyNewOverviewButtonIsAbsent = () =>
    this.step("verifyNewOverviewButtonIsAbsent", () => this.expectNotToBeVisible(appShellTestIds.newOverviewButton));

  verifyCarriesTheLibraryChrome = () =>
    this.step("verifyCarriesTheLibraryChrome", async () => {
      await this.expectToBeVisible(appShellTestIds.newOverviewButton);
      await expect(this.page.getByRole("navigation", { name: "Sections" })).toHaveCount(1);
    });

  clickBrand = () => this.step("clickBrand", () => this.click(appShellTestIds.brand));

  // Both links share a name, so the count of reachable ones says whose turn it is.
  verifyBarHoldsTheBrand = (label = "All overviews") =>
    this.step(`verifyBarHoldsTheBrand ${label}`, async () => {
      await expect(this.get(appShellTestIds.brand)).not.toHaveAttribute("inert");
      await expect(this.get(appShellTestIds.backLink)).toHaveAttribute("inert", "");
      await expect(this.page.getByRole("link", { name: label, exact: true })).toHaveCount(1);
    });

  verifyBarHoldsTheWayBack = (label = "All overviews") =>
    this.step(`verifyBarHoldsTheWayBack ${label}`, async () => {
      await expect(this.get(appShellTestIds.backLink)).not.toHaveAttribute("inert");
      await expect(this.get(appShellTestIds.brand)).toHaveAttribute("inert", "");
      await expect(this.page.getByRole("link", { name: label, exact: true })).toHaveCount(2);
    });

  verifyBarIsTheOnlyWayBack = (label: string) =>
    this.step(`verifyBarIsTheOnlyWayBack ${label}`, async () => {
      await expect(this.get(appShellTestIds.backLink)).not.toHaveAttribute("inert");
      await expect(this.get(appShellTestIds.brand)).toHaveAttribute("inert", "");
      await expect(this.page.getByRole("link", { name: label, exact: true })).toHaveCount(1);
    });

  verifyBarKeepsHoldingTheWayBack = (forMs: number) =>
    this.step(`verifyBarKeepsHoldingTheWayBack ${forMs}`, async () => {
      const swaps = await this.page.evaluate(
        ([testId, ms]) =>
          new Promise<number>((resolve) => {
            const link = document.querySelector(`[data-testid="${testId}"]`)!;
            let count = 0;
            const observer = new MutationObserver(() => {
              count += 1;
            });
            observer.observe(link, { attributes: true, attributeFilter: ["inert"] });
            setTimeout(() => {
              observer.disconnect();
              resolve(count);
            }, ms);
          }),
        [appShellTestIds.backLink, forMs] as const,
      );
      expect(swaps).toBe(0);
    });

  verifyBarNeverOffersTheWayBack = () =>
    this.step("verifyBarNeverOffersTheWayBack", async () => {
      await this.expectToHaveCount(appShellTestIds.backLink, 0);
      await expect(this.get(appShellTestIds.brand)).not.toHaveAttribute("inert");
    });

  // Tapped in place: a locator click would scroll the stuck bar to the top and hand the slot back.
  clickBackInBar = (): Promise<LibraryPageObject> =>
    this.step("clickBackInBar", async () => {
      await this.tapBackInBar();
      return new LibraryPageObject(this.testContext).verifyIsShown();
    });

  clickBackInBarToAllProjects = (): Promise<ProjectsIndexPageObject> =>
    this.step("clickBackInBarToAllProjects", async () => {
      await this.tapBackInBar();
      return new ProjectsIndexPageObject(this.testContext).verifyIsShown();
    });

  clickBackInBarToSettings = (): Promise<SettingsPageObject> =>
    this.step("clickBackInBarToSettings", async () => {
      await this.tapBackInBar();
      const settings = await new SettingsPageObject(this.testContext).verifyIsShown();
      await settings.verifyListIsShown(true);
      return settings;
    });

  private tapBackInBar = async () => {
    await expect
      .poll(() =>
        this.page.evaluate(() =>
          document.getAnimations().some((animation) => {
            const effect = animation.effect;
            return effect instanceof KeyframeEffect && (effect.pseudoElement ?? "").startsWith("::view-transition");
          }),
        ),
      )
      .toBe(false);
    const box = (await this.get(appShellTestIds.backLink).boundingBox())!;
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };

  clickNewOverview = () => this.step("clickNewOverview", () => this.click(appShellTestIds.newOverviewButton));

  verifyNewOverviewHasFocus = () =>
    this.step("verifyNewOverviewHasFocus", () => expect(this.get(appShellTestIds.newOverviewButton)).toBeFocused());

  verifyNewOverviewButtonIsTheWebsSize = () =>
    this.step("verifyNewOverviewButtonIsTheWebsSize", async () =>
      expect(await this.newOverviewButtonSizing()).toEqual({ minHeight: "auto", paddingInline: "14px" }),
    );

  private newOverviewButtonSizing = () =>
    this.get(appShellTestIds.newOverviewButton).evaluate((element) => {
      const style = getComputedStyle(element);
      return { minHeight: style.minHeight, paddingInline: style.paddingLeft };
    });

  verifyGapToTheAccountMenuIs = (pixels: number) =>
    this.step(`verifyGapToTheAccountMenuIs ${pixels}`, async () => {
      const button = (await this.get(appShellTestIds.newOverviewButton).boundingBox())!;
      const account = (await this.get(accountMenuTestIds.trigger).boundingBox())!;
      expect(Math.round(account.x - (button.x + button.width))).toBe(pixels);
    });

  openNewOverview = (): Promise<NewOverviewDialogPageObject> =>
    this.step("openNewOverview", async () => {
      await this.clickNewOverview();
      return this.newOverviewDialog.verifyIsShown();
    });

  openAsk = (): Promise<AskPagePageObject> =>
    this.step("openAsk", async () => {
      await this.click(appShellTestIds.askButton);
      return new AskPagePageObject(this.testContext).verifyIsShown();
    });

  verifyIconButtonWithTip = (which: "ask" | "new", tip: string) =>
    this.step(`verifyIconButtonWithTip ${which}`, async () => {
      const button = this.get(which === "ask" ? appShellTestIds.askButton : appShellTestIds.newOverviewButton);
      const box = (await button.boundingBox())!;
      expect(Math.round(box.width)).toBe(44);
      expect(Math.round(box.height)).toBe(44);
      await expect(button).toHaveAccessibleName(tip);
      await button.hover();
      await expect(button.locator("xpath=following-sibling::span[1]")).toBeVisible();
      await expect(button.locator("xpath=following-sibling::span[1]")).toHaveText(tip);
    });

  verifyOffersAsk = (offers: boolean) =>
    this.step(`verifyOffersAsk ${offers}`, () => this.expectToHaveCount(appShellTestIds.askButton, offers ? 1 : 0));

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      const menu = await this.accountMenu.open();
      return menu.chooseSettings();
    });

  verifyOffersNotNow = (offers: boolean) =>
    this.step(`verifyOffersNotNow ${offers}`, () =>
      offers ? this.expectToBeVisible(appShellTestIds.notNowLink) : this.expectNotToBeVisible(appShellTestIds.notNowLink),
    );

  clickNotNow = () => this.step("clickNotNow", () => this.click(appShellTestIds.notNowLink));
}

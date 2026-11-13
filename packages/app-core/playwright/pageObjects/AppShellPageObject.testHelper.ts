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

  // The wall stands in for the pane, so it is the shell's to find
  // (docs/features/record-migrations.md, "Below the write floor is a wall").
  get writeFloorWall(): ErrorStatePageObject {
    return new ErrorStatePageObject(this.testContext, this.get(appShellTestIds.pane));
  }

  // paneTransitions.scss is a stylesheet and can't be asserted on, but it keys every rule
  // off this one attribute, so this is where the way in and the way back are actually held.
  verifyNavigationDirection = (direction: NavigationDirection) =>
    this.step(`verifyNavigationDirection ${direction}`, () =>
      expect(this.page.locator("html")).toHaveAttribute("data-nav-direction", direction),
    );

  // A view transition paints its snapshots into the browser's top layer, so nothing in the
  // page's own tree records that one ran; its pseudo-element animations are the only sign
  // (docs/features/page-transitions.md). The recorder is installed before the navigation and
  // read after it, rather than polled against a deadline: under the whole suite's load a
  // round-trip to the page can easily take longer than a 260ms animation, and a watcher that
  // arrives late cannot tell "it never ran" from "I missed it".
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

  // Design OV-170: the row's thumbnail and the note's head are one object, which exists only
  // as an `overview-image` snapshot group for the length of the journey.
  verifyImageCarriesAcross = <T>(go: () => Promise<T>): Promise<T> =>
    this.step("verifyImageCarriesAcross", async () => {
      const arrived = await this.whileRecordingTransitions(go);
      expect(arrived.seen.map(pseudoOf)).toContain(OVERVIEW_IMAGE_GROUP);
      return arrived.result;
    });

  // The pane's own transition still runs here, so this asks for the image's group alone
  // rather than for any transition at all.
  verifyImageDoesNotCarryAcross = <T>(go: () => Promise<T>): Promise<T> =>
    this.step("verifyImageDoesNotCarryAcross", async () => {
      const arrived = await this.whileRecordingTransitions(go);
      expect(arrived.seen.map(pseudoOf)).not.toContain(OVERVIEW_IMAGE_GROUP);
      return arrived.result;
    });

  // Design OV-170 170h, "The pane while it runs": the 10px slide is dropped for this one
  // journey, so the pane's own snapshot crossfades rather than travelling. Which keyframes
  // are playing is the only place that difference exists.
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

  // The app opens every one of these through document.startViewTransition, so that is what
  // is listened to. Whether a navigation asked for one at all is counted, which is the whole
  // question for a link that was missing the flag; what it painted is read at `ready`, which
  // settles when the pseudo-element tree exists and its animations have been built. The two
  // are kept apart because `ready` never settles for a transition the next navigation skips,
  // and that says nothing about whether this one was asked for. Sampling instead — a requestAnimationFrame loop over
  // document.getAnimations() — records nothing in a backgrounded window, which is most of
  // them when the suite runs in parallel, and a real transition then reads as none at all.
  // `animationstart` is no use either: it does not fire for view-transition pseudo-elements.
  private whileRecordingTransitions = async <T>(go: () => Promise<T>): Promise<{ result: T; seen: string[]; opened: number }> => {
    // React Router skips a transition that is still running when the next navigation starts,
    // and a skipped one never reaches `ready`. Waiting for quiet first keeps each assertion
    // about its own journey rather than the tail of the one before it.
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

  // Design 205c: the panel's bar is the phone's — the brand slot, + New and the account
  // menu — and still has no section nav, there being one video rather than a library.
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

  // Design OV-167: one slot, two links, and only the one shown reaches the keyboard or a
  // screen reader. Both are named "All overviews", so the count of reachable links with
  // that name is what says whose turn it is (docs/features/back-within-reach.md).
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

  // Where the page draws no link of its own, the bar holds the only one there is, named
  // after what home is about (designs 205d-2 and 205g-4).
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

  // Tapped where it is: a locator click would first scroll the stuck bar "into view", which
  // is the top of the page, and the head's own link coming back would hand the slot back.
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

  // The bar's + New is the web's pill everywhere but a touch-sized full layout, where it
  // grows to the 44px target (docs/features/extension-panel.md, "+ New joins the panel's bar").
  verifyNewOverviewButtonIsTheWebsSize = () =>
    this.step("verifyNewOverviewButtonIsTheWebsSize", async () =>
      expect(await this.newOverviewButtonSizing()).toEqual({ minHeight: "auto", paddingInline: "14px" }),
    );

  verifyNewOverviewButtonIsTheTouchTarget = () =>
    this.step("verifyNewOverviewButtonIsTheTouchTarget", async () =>
      expect(await this.newOverviewButtonSizing()).toEqual({ minHeight: "44px", paddingInline: "16px" }),
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

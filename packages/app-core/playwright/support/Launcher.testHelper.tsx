import { test, type ComponentFixtures } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { PlaybackPosition } from "../../src/app/PlaybackContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import type { Plan } from "@overview/types";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import type { TestContext } from "./TestContext.testHelper.js";
import { IwftAppRoot } from "./IwftAppRoot.testHelper.js";
import { CapturePageObject } from "../pageObjects/CapturePageObject.testHelper.js";
import { HomePageObject } from "../pageObjects/HomePageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "../pageObjects/GenerateOverviewFormPageObject.testHelper.js";
import { LibraryPageObject } from "../pageObjects/LibraryPageObject.testHelper.js";
import { AppShellPageObject } from "../pageObjects/AppShellPageObject.testHelper.js";
import { ReaderPageObject } from "../pageObjects/ReaderPageObject.testHelper.js";
import { SettingsPageObject } from "../pageObjects/SettingsPageObject.testHelper.js";

export interface LaunchOptions {
  apiKeys?: ApiKeys;
  surface?: Surface;
  layout?: AppLayout;
  activeVideoUrl?: string | null;
  playback?: PlaybackPosition | null;
  plan?: Plan;
}

export class Launcher {
  constructor(
    private readonly mount: ComponentFixtures["mount"],
    private readonly page: Page,
    readonly backendSimulator: BackendSimulator,
  ) {}

  private get testContext(): TestContext {
    return { page: this.page, backendSimulator: this.backendSimulator };
  }

  // The panel's home is the capture screen rather than the library, so it lands
  // somewhere else and needs its own launcher (frontend-testing-guide.md 5.2).
  launchPanel = (options: LaunchOptions = {}): Promise<CapturePageObject> =>
    test.step("Launcher.launchPanel", async () => {
      await this.mountApp({ ...options, layout: "panel", surface: options.surface ?? "extension" });
      return new CapturePageObject(this.testContext).verifyIsShown();
    });

  launch = (options: LaunchOptions = {}): Promise<HomePageObject> =>
    test.step("Launcher.launch", async () => {
      await this.mountApp(options);
      return new HomePageObject(this.testContext).verifyIsShown();
    });

  private mountApp = async (options: LaunchOptions): Promise<void> => {
    await this.backendSimulator.handleNetworking();
    await this.mount(<IwftAppRoot />, {
      hooksConfig: {
        ...this.backendSimulator.buildHooksConfig(),
        seedSettings: options.plan === undefined ? undefined : { plan: options.plan },
        apiKeys: options.apiKeys,
        surface: options.surface,
        layout: options.layout,
        activeVideoUrl: options.activeVideoUrl,
        playback: options.playback,
      },
    });
  };

  launchExpectingFirstRun = (
    options: LaunchOptions = {},
  ): Promise<GenerateOverviewFormPageObject> =>
    test.step("Launcher.launchExpectingFirstRun", async () => {
      const home = await this.launch(options);
      await home.verifyShowsFirstRunHero();
      const dialog = await this.appShell.openNewOverview();
      return dialog.form;
    });

  // The shell's own view of which tab is in front, moved the way a tab change moves it.
  // Nothing in app-core can reach chrome.tabs, so the simulated source is the seam.
  watchAnotherVideo = (videoUrl: string | null): Promise<void> =>
    test.step(`Launcher.watchAnotherVideo ${videoUrl}`, () =>
      this.page.evaluate((next) => window.__iwftActiveVideo__?.watchAnother(next), videoUrl));

  // The player in the tab beside the panel, moved the way playing the video moves it.
  movePlaybackTo = (position: PlaybackPosition | null): Promise<void> =>
    test.step(`Launcher.movePlaybackTo ${position?.positionMs ?? "nothing"}`, () =>
      this.page.evaluate((next) => window.__iwftPlayback__?.moveTo(next), position));

  get capturePage(): CapturePageObject {
    return new CapturePageObject(this.testContext);
  }

  get appShell(): AppShellPageObject {
    return new AppShellPageObject(this.testContext);
  }

  get readerPage(): ReaderPageObject {
    return new ReaderPageObject(this.testContext);
  }

  get settingsPage(): SettingsPageObject {
    return new SettingsPageObject(this.testContext);
  }

  launchExpectingLibrary = (options: LaunchOptions = {}): Promise<LibraryPageObject> =>
    test.step("Launcher.launchExpectingLibrary", async () => {
      const home = await this.launch(options);
      return home.verifyShowsLibrary();
    });
}

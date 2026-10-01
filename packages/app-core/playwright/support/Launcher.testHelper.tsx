import { test, type ComponentFixtures } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import type { AppBuild } from "../../src/app/AppBuildContext.js";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { PlaybackPosition } from "../../src/app/PlaybackContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import { SHARE_PAYLOAD_ELEMENT_ID, type MilestoneMarks, type NarrationVoice, type Plan } from "@overview/domain";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import type { SyncConnectionInput } from "../../src/features/sync/types/SyncConnection.js";
import type { PendingSignIn } from "../../src/features/auth/types/PendingSignIn.js";
import { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import type { InMemoryStoreRead } from "../network/InMemoryOverviewStore.testHelper.js";
import type { TestContext } from "./TestContext.testHelper.js";
import { IwftAppRoot } from "./IwftAppRoot.testHelper.js";
import { ConsentPageObject } from "../pageObjects/ConsentPageObject.testHelper.js";
import { CapturePageObject } from "../pageObjects/CapturePageObject.testHelper.js";
import { ErrorStatePageObject } from "../pageObjects/ErrorStatePageObject.testHelper.js";
import { HomePageObject } from "../pageObjects/HomePageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "../pageObjects/GenerateOverviewFormPageObject.testHelper.js";
import { LibraryPageObject } from "../pageObjects/LibraryPageObject.testHelper.js";
import { MiniPlayerPageObject } from "../pageObjects/MiniPlayerPageObject.testHelper.js";
import { AppShellPageObject } from "../pageObjects/AppShellPageObject.testHelper.js";
import { ReaderPageObject } from "../pageObjects/ReaderPageObject.testHelper.js";
import { SettingsPageObject } from "../pageObjects/SettingsPageObject.testHelper.js";
import { SharedOverviewPageObject } from "../pageObjects/SharedOverviewPageObject.testHelper.js";
import { SignInPageObject } from "../pageObjects/SignInPageObject.testHelper.js";
import { Routes } from "../../src/app/Routes.js";

export interface LaunchOptions {
  apiKeys?: ApiKeys;
  // Whether this shell can sync, and the server and token it already has.
  sync?: boolean;
  syncConnection?: SyncConnectionInput;
  pendingSignIn?: PendingSignIn;
  surface?: Surface;
  layout?: AppLayout;
  defaultApiUrl?: string;
  build?: AppBuild;
  activeVideoUrl?: string | null;
  playback?: PlaybackPosition | null;
  // The account's plan, as the server holds it; only a signed-in launch has one.
  plan?: Plan;
  narrationVoice?: NarrationVoice;
  // The time-saved milestones the account has already crossed or dismissed.
  milestones?: MilestoneMarks;
  runBridge?: boolean;
  youTubeFetch?: boolean;
  failingReads?: InMemoryStoreRead[];
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

  // A launch that lands on the dead-end screen rather than a page, because the read the
  // landing page depends on was told to fail (frontend-testing-guide.md 5.2).
  launchExpectingDeadEnd = (options: LaunchOptions = {}): Promise<ErrorStatePageObject> =>
    test.step("Launcher.launchExpectingDeadEnd", async () => {
      await this.mountApp(options);
      return new ErrorStatePageObject(this.testContext).verifyIsShown();
    });

  private mountApp = async (options: LaunchOptions): Promise<void> => {
    if (options.plan !== undefined) this.backendSimulator.auth.accountIsOn(options.plan);
    await this.backendSimulator.handleNetworking();
    await this.mount(<IwftAppRoot />, {
      hooksConfig: {
        ...this.backendSimulator.buildHooksConfig(),
        seedSettings: {
          ...(options.narrationVoice === undefined ? {} : { narrationVoice: options.narrationVoice }),
          ...(options.milestones === undefined ? {} : { milestones: options.milestones }),
        },
        apiKeys: options.apiKeys,
        syncAvailable: options.sync,
        syncConnection: options.syncConnection,
        pendingSignIn: options.pendingSignIn,
        surface: options.surface,
        layout: options.layout,
        defaultApiUrl: options.defaultApiUrl,
        build: options.build,
        activeVideoUrl: options.activeVideoUrl,
        playback: options.playback,
        runBridge: options.runBridge,
        youTubeFetch: options.youTubeFetch,
        failingReads: options.failingReads,
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

  // The read recovering underneath a dead-end screen, so pressing its action can succeed.
  stopFailing = (read: InMemoryStoreRead): Promise<void> =>
    test.step(`Launcher.stopFailing ${read}`, () =>
      this.page.evaluate(
        (next) => window.__iwftStores__.overviewStore.recoverRead(next),
        read,
      ));

  // The shell's own view of which tab is in front, moved the way a tab change moves it.
  // Nothing in app-core can reach chrome.tabs, so the simulated source is the seam.
  watchAnotherVideo = (videoUrl: string | null): Promise<void> =>
    test.step(`Launcher.watchAnotherVideo ${videoUrl}`, () =>
      this.page.evaluate((next) => window.__iwftActiveVideo__?.watchAnother(next), videoUrl));

  // The player in the tab beside the panel, moved the way playing the video moves it.
  movePlaybackTo = (position: PlaybackPosition | null): Promise<void> =>
    test.step(`Launcher.movePlaybackTo ${position?.positionMs ?? "nothing"}`, () =>
      this.page.evaluate((next) => window.__iwftPlayback__?.moveTo(next), position));

  // Pressing the button injected into the YouTube page, from app-core's side of the
  // seam (docs/features/injected-button.md).
  pressInjectedButton = (videoUrl: string): Promise<void> =>
    test.step(`Launcher.pressInjectedButton ${videoUrl}`, () =>
      this.page.evaluate((url) => window.__iwftRunBridge__?.requestOverview(url), videoUrl));

  readRunReports = (): Promise<Array<{ status: string; videoUrl: string } | null>> =>
    test.step("Launcher.readRunReports", () =>
      this.page.evaluate(
        () =>
          window.__iwftRunBridge__?.reports.map((report) =>
            report === null ? null : { status: report.status, videoUrl: report.videoUrl },
          ) ?? [],
      ));

  readPlaybackSeeks = (): Promise<number[]> =>
    test.step("Launcher.readPlaybackSeeks", () =>
      this.page.evaluate(() => window.__iwftPlayback__?.seeks ?? []));

  // Opening the link from the email: the sign-in path with the token in the hash, or with
  // no token at all (docs/features/sign-in.md).
  openSignInLink = (token: string | null, returnTo: string | null = null): Promise<void> =>
    test.step(`Launcher.openSignInLink ${token ?? "without a token"}`, () =>
      this.page.evaluate(
        ({ path, search, hash }) => window.__iwftRouter__.navigate({ pathname: path, search, hash }),
        {
          path: Routes.signIn(),
          search: returnTo === null ? "" : `?return=${encodeURIComponent(returnTo)}`,
          hash: token === null ? "" : `#token=${encodeURIComponent(token)}`,
        },
      ));

  // Arriving from an assistant: it sends the reader's browser to the consent screen.
  openConsent = (requestId: string): Promise<void> =>
    this.openPage(Routes.connect(requestId));

  // Going to a page by its address, the way a typed or bookmarked URL arrives.
  openPage = (path: string): Promise<void> =>
    test.step(`Launcher.openPage ${path}`, () =>
      this.page.evaluate((pathname) => window.__iwftRouter__.navigate(pathname), path));

  get consentPage(): ConsentPageObject {
    return new ConsentPageObject(this.testContext);
  }

  get signInPage(): SignInPageObject {
    return new SignInPageObject(this.testContext);
  }

  get homePage(): HomePageObject {
    return new HomePageObject(this.testContext);
  }

  get capturePage(): CapturePageObject {
    return new CapturePageObject(this.testContext);
  }

  get miniPlayer(): MiniPlayerPageObject {
    return new MiniPlayerPageObject(this.testContext);
  }

  get appShell(): AppShellPageObject {
    return new AppShellPageObject(this.testContext);
  }

  get errorState(): ErrorStatePageObject {
    return new ErrorStatePageObject(this.testContext);
  }

  get readerPage(): ReaderPageObject {
    return new ReaderPageObject(this.testContext);
  }

  get settingsPage(): SettingsPageObject {
    return new SettingsPageObject(this.testContext);
  }

  get sharedOverviewPage(): SharedOverviewPageObject {
    return new SharedOverviewPageObject(this.testContext);
  }

  // The copy the API inlines in the document a shared link opens, put there the same way
  // (docs/features/sharing.md).
  inlineSharePayload = (payload: unknown): Promise<void> =>
    test.step("Launcher.inlineSharePayload", () =>
      this.page.evaluate(
        ({ id, json }) => {
          document.getElementById(id)?.remove();
          const script = document.createElement("script");
          script.id = id;
          script.type = "application/json";
          script.textContent = json;
          document.body.append(script);
        },
        { id: SHARE_PAYLOAD_ELEMENT_ID, json: JSON.stringify(payload) },
      ));

  launchExpectingLibrary = (options: LaunchOptions = {}): Promise<LibraryPageObject> =>
    test.step("Launcher.launchExpectingLibrary", async () => {
      const home = await this.launch(options);
      return home.verifyShowsLibrary();
    });
}

import type { IwftArticlePagesConfig } from "../network/IwftArticlePages.testHelper.js";
import type { IwftTikTokPagesConfig } from "../network/IwftTikTokPages.testHelper.js";
import { expect, test, type ComponentFixtures } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import type { AppBuild } from "../../src/app/AppBuildContext.js";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { PlaybackPosition } from "../../src/app/PlaybackContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import {
  aboutYouPatch,
  SHARE_PAYLOAD_ELEMENT_ID,
  type AboutYou,
  type AccentColour,
  type HeadImageSize,
  type LearnedItems,
  type MilestoneMarks,
  type NarrationVoice,
  type Plan,
  type SectionsEnabled,
  type FollowUpAssistant,
  type Settings,
  type ThemeMode,
  type ModelByProvider,
  type Provider,
} from "@overview/domain";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import type { SyncConnectionInput } from "../../src/features/sync/types/SyncConnection.js";
import type { OnboardingRunPhase } from "../../src/features/onboarding/useOnboardingRun.js";
import type { PendingSignIn } from "../../src/features/auth/types/PendingSignIn.js";
import type { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../network/BackendSimulator.testHelper.js";
import type { InMemoryStoreRead } from "../network/InMemoryOverviewStore.testHelper.js";
import type { TestContext } from "./TestContext.testHelper.js";
import { IwftAppRoot } from "./IwftAppRoot.testHelper.js";
import { ConsentPageObject } from "../pageObjects/ConsentPageObject.testHelper.js";
import { CapturePageObject } from "../pageObjects/CapturePageObject.testHelper.js";
import { ErrorStatePageObject } from "../pageObjects/ErrorStatePageObject.testHelper.js";
import { HomePageObject } from "../pageObjects/HomePageObject.testHelper.js";
import { homePageTestIds } from "../../src/features/home/HomePage/HomePageTestIds.js";
import type { GenerateOverviewFormPageObject } from "../pageObjects/GenerateOverviewFormPageObject.testHelper.js";
import type { LibraryPageObject } from "../pageObjects/LibraryPageObject.testHelper.js";
import { MiniPlayerPageObject } from "../pageObjects/MiniPlayerPageObject.testHelper.js";
import { AppShellPageObject } from "../pageObjects/AppShellPageObject.testHelper.js";
import { ReaderPageObject } from "../pageObjects/ReaderPageObject.testHelper.js";
import { SettingsPageObject } from "../pageObjects/SettingsPageObject.testHelper.js";
import { SharedOverviewPageObject } from "../pageObjects/SharedOverviewPageObject.testHelper.js";
import { SignInPageObject } from "../pageObjects/SignInPageObject.testHelper.js";
import { RevertEmailPageObject } from "../pageObjects/RevertEmailPageObject.testHelper.js";
import { Routes } from "../../src/app/Routes.js";
import type { SignedOutTrial } from "../../src/features/signedOutTrial/types/SignedOutTrial.js";
import { AccountTermsLinePageObject } from "../pageObjects/AccountTermsLinePageObject.testHelper.js";
import { LegalPagePageObject } from "../pageObjects/LegalPagePageObject.testHelper.js";
import { makeAnalyticsConsent } from "../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";
import type { AnalyticsConsent } from "../../src/features/analyticsConsent/types/AnalyticsConsent.js";
import { LibraryMoveNoticePageObject } from "../pageObjects/LibraryMoveNoticePageObject.testHelper.js";
import { OpeningLibraryPageObject } from "../pageObjects/OpeningLibraryPageObject.testHelper.js";
import { SignedOutGatePageObject } from "../pageObjects/SignedOutGatePageObject.testHelper.js";
import { OnboardingPageObject } from "../pageObjects/OnboardingPageObject.testHelper.js";
import { OnboardingSamplesPageObject } from "../pageObjects/OnboardingSamplesPageObject.testHelper.js";
import { SampleDeckPageObject } from "../pageObjects/SampleDeckPageObject.testHelper.js";
import { PlansModalPageObject } from "../pageObjects/PlansModalPageObject.testHelper.js";
import { SavedItemPageObject } from "../pageObjects/SavedItemPageObject.testHelper.js";
import { SoftWallPageObject } from "../pageObjects/SoftWallPageObject.testHelper.js";
import { createAccountThroughSample } from "../pageObjects/createAccountThroughSample.testHelper.js";
import { signedOutGateTestIds } from "../../src/features/accountLibraries/components/SignedOutGate/SignedOutGateTestIds.js";
import { HowToApplyLinePageObject } from "../pageObjects/HowToApplyLinePageObject.testHelper.js";
import { LearnedNoticePageObject } from "../pageObjects/LearnedNoticePageObject.testHelper.js";
import { AboutYouAskPageObject } from "../pageObjects/AboutYouAskPageObject.testHelper.js";
import { OnboardingNextStepsPageObject } from "../pageObjects/OnboardingNextStepsPageObject.testHelper.js";
import { FirstOverviewMilestonePageObject } from "../pageObjects/FirstOverviewMilestonePageObject.testHelper.js";
import { SignOutNoticePageObject } from "../pageObjects/SignOutNoticePageObject.testHelper.js";

export interface LaunchOptions {
  apiKeys?: ApiKeys;
  sync?: boolean;
  syncConnection?: SyncConnectionInput;
  pendingSignIn?: PendingSignIn;
  signedOutTrial?: SignedOutTrial;
  // Absent is a "no" already given, so other scenarios aren't asked; null is never asked.
  analyticsConsent?: AnalyticsConsent | null;
  accountSeen?: boolean;
  surface?: Surface;
  // False is a phone's browser; absent is desktop Chrome.
  desktopChrome?: boolean;
  layout?: AppLayout;
  defaultApiUrl?: string;
  // False is a Web Store build, which offers no other server.
  serverSwitchable?: boolean;
  build?: AppBuild;
  activeVideoUrl?: string | null;
  articlePages?: IwftArticlePagesConfig;
  tiktokPages?: IwftTikTokPagesConfig;
  playback?: PlaybackPosition | null;
  plan?: Plan;
  narrationVoice?: NarrationVoice;
  readStepsAloud?: boolean;
  // It syncs while keys don't, so a scenario can seed a device holding the wrong one.
  provider?: Provider;
  modelByProvider?: ModelByProvider;
  milestones?: MilestoneMarks;
  showMilestoneCards?: boolean;
  theme?: ThemeMode;
  accentColour?: AccentColour;
  headImageSize?: HeadImageSize;
  accentMirror?: boolean;
  onlyMyKey?: boolean;
  aboutYou?: AboutYou;
  // True unless a scenario asks for it: only aboutYouAsk.iwft.ts meets the ask at a save (OV-356).
  aboutYouAskedAfterOnboarding?: boolean;
  learned?: LearnedItems;
  keepLearning?: boolean;
  shareProfileWithAssistants?: boolean;
  sectionsEnabled?: SectionsEnabled;
  followUpAssistant?: FollowUpAssistant;
  questionsAnsweredHere?: boolean;
  runBridge?: boolean;
  youTubeFetch?: boolean;
  failingReads?: InMemoryStoreRead[];
  errorDestinationMirror?: boolean;
}

const isSignedOutWhereThereAreAccounts = (options: LaunchOptions): boolean => options.sync === true && !options.syncConnection?.apiUrl;

export class Launcher {
  private readonly mount: ComponentFixtures["mount"];
  private readonly page: Page;
  readonly backendSimulator: BackendSimulator;

  constructor(mount: ComponentFixtures["mount"], page: Page, backendSimulator: BackendSimulator) {
    this.mount = mount;
    this.page = page;
    this.backendSimulator = backendSimulator;
  }

  private get testContext(): TestContext {
    return { page: this.page, backendSimulator: this.backendSimulator };
  }

  // The panel's home is the capture screen, not the library, so it needs its own launcher.
  launchPanel = (options: LaunchOptions = {}): Promise<CapturePageObject> =>
    test.step("Launcher.launchPanel", async () => {
      await this.mountApp({ ...options, layout: "panel", surface: options.surface ?? "extension" });
      const capture = new CapturePageObject(this.testContext);
      if (isSignedOutWhereThereAreAccounts(options)) {
        await expect(this.page.getByTestId(homePageTestIds.hero).or(this.page.getByTestId(signedOutGateTestIds.root))).toBeVisible();
        return capture;
      }
      return capture.verifyIsShown();
    });

  launch = (options: LaunchOptions = {}): Promise<HomePageObject> =>
    test.step("Launcher.launch", async () => {
      await this.mountApp(options);
      const home = new HomePageObject(this.testContext);
      if (isSignedOutWhereThereAreAccounts(options)) {
        return (await home.verifyIsShown()).verifyShowsStart();
      }
      return home.verifyIsShown();
    });

  // The wall can replace the page before home is ever seen, so home is not waited for.
  launchExpectingWriteFloorWall = (options: LaunchOptions = {}): Promise<ErrorStatePageObject> =>
    test.step("Launcher.launchExpectingWriteFloorWall", async () => {
      await this.mountApp(options);
      return this.appShell.writeFloorWall.verifyIsShown();
    });

  launchExpectingDeadEnd = (options: LaunchOptions = {}): Promise<ErrorStatePageObject> =>
    test.step("Launcher.launchExpectingDeadEnd", async () => {
      await this.mountApp(options);
      return new ErrorStatePageObject(this.testContext).verifyIsShown();
    });

  private mountApp = async (options: LaunchOptions): Promise<void> => {
    if (options.plan !== undefined) {
      this.backendSimulator.auth.accountIsOn(options.plan);
    }
    await this.backendSimulator.handleNetworking();
    await this.mount(<IwftAppRoot />, {
      hooksConfig: {
        ...this.backendSimulator.buildHooksConfig(),
        seedSettings: {
          ...(options.narrationVoice === undefined ? {} : { narrationVoice: options.narrationVoice }),
          ...(options.readStepsAloud === undefined ? {} : { readStepsAloud: options.readStepsAloud }),
          ...(options.provider === undefined ? {} : { provider: options.provider }),
          ...(options.modelByProvider === undefined ? {} : { modelByProvider: options.modelByProvider }),
          ...(options.milestones === undefined ? {} : { milestones: options.milestones }),
          ...(options.showMilestoneCards === undefined ? {} : { showMilestoneCards: options.showMilestoneCards }),
          ...(options.theme === undefined ? {} : { theme: options.theme }),
          ...(options.accentColour === undefined ? {} : { accentColour: options.accentColour }),
          ...(options.headImageSize === undefined ? {} : { headImageSize: options.headImageSize }),
          ...(options.onlyMyKey === undefined ? {} : { onlyMyKey: options.onlyMyKey }),
          ...(options.aboutYou === undefined ? {} : aboutYouPatch(options.aboutYou)),
          aboutYouAskedAfterOnboarding: options.aboutYouAskedAfterOnboarding ?? true,
          ...(options.learned === undefined ? {} : { learned: options.learned }),
          ...(options.keepLearning === undefined ? {} : { keepLearning: options.keepLearning }),
          ...(options.shareProfileWithAssistants === undefined ? {} : { shareProfileWithAssistants: options.shareProfileWithAssistants }),
          ...(options.sectionsEnabled === undefined ? {} : { sectionsEnabled: options.sectionsEnabled }),
          ...(options.followUpAssistant === undefined ? {} : { followUpAssistant: options.followUpAssistant }),
          ...(options.questionsAnsweredHere === undefined ? {} : { questionsAnsweredHere: options.questionsAnsweredHere }),
        },
        apiKeys: options.apiKeys,
        syncAvailable: options.sync,
        syncConnection: options.syncConnection,
        pendingSignIn: options.pendingSignIn,
        signedOutTrial: options.signedOutTrial,
        analyticsConsent: options.analyticsConsent === undefined ? makeAnalyticsConsent() : options.analyticsConsent,
        ...(options.accountSeen === true ? { accountSeen: true } : {}),
        surface: options.surface,
        desktopChrome: options.desktopChrome,
        layout: options.layout,
        defaultApiUrl: options.defaultApiUrl,
        serverSwitchable: options.serverSwitchable,
        build: options.build,
        activeVideoUrl: options.activeVideoUrl,
        articlePages: options.articlePages,
        tiktokPages: options.tiktokPages,
        playback: options.playback,
        runBridge: options.runBridge,
        youTubeFetch: options.youTubeFetch,
        failingReads: options.failingReads,
        errorDestinationMirror: options.errorDestinationMirror,
        accentMirror: options.accentMirror,
      },
    });
  };

  launchExpectingFirstRun = (options: LaunchOptions = {}): Promise<GenerateOverviewFormPageObject> =>
    test.step("Launcher.launchExpectingFirstRun", async () => {
      const home = await this.launch(options);
      await home.verifyShowsFirstRunHero();
      const dialog = await this.appShell.openNewOverview();
      return dialog.form;
    });

  stopFailing = (read: InMemoryStoreRead): Promise<void> =>
    test.step(`Launcher.stopFailing ${read}`, () =>
      this.page.evaluate((next) => window.__iwftStores__.overviewStore.recoverRead(next), read));

  // Nothing in app-core can reach chrome.tabs, so the simulated source is the seam.
  watchAnotherVideo = (videoUrl: string | null): Promise<void> =>
    test.step(`Launcher.watchAnotherVideo ${videoUrl}`, () =>
      this.page.evaluate((next) => window.__iwftActiveVideo__?.watchAnother(next), videoUrl));

  movePlaybackTo = (position: PlaybackPosition | null): Promise<void> =>
    test.step(`Launcher.movePlaybackTo ${position?.positionMs ?? "nothing"}`, () =>
      this.page.evaluate((next) => window.__iwftPlayback__?.moveTo(next), position));

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

  readErrorDestinations = (): Promise<Array<{ apiUrl: string | null; token: string | null }>> =>
    test.step("Launcher.readErrorDestinations", () => this.page.evaluate(() => window.__iwftErrorDestinations__ ?? []));

  readAccentMirror = (): Promise<AccentColour[]> =>
    test.step("Launcher.readAccentMirror", () => this.page.evaluate(() => window.__iwftAccentMirror__ ?? []));

  settingsStoreRead = (): Promise<Settings> =>
    test.step("Launcher.settingsStoreRead", () => this.page.evaluate(() => window.__iwftStores__.settingsStore.get()));

  readPlaybackSeeks = (): Promise<number[]> =>
    test.step("Launcher.readPlaybackSeeks", () => this.page.evaluate(() => window.__iwftPlayback__?.seeks ?? []));

  openSignInLink = (token: string | null, returnTo: string | null = null): Promise<void> =>
    test.step(`Launcher.openSignInLink ${token ?? "without a token"}`, () =>
      this.page.evaluate(({ path, search, hash }) => window.__iwftRouter__.navigate({ pathname: path, search, hash }), {
        path: Routes.signIn(),
        search: returnTo === null ? "" : `?return=${encodeURIComponent(returnTo)}`,
        hash: token === null ? "" : `#token=${encodeURIComponent(token)}`,
      }));

  signInFromAnotherTab = (): Promise<void> =>
    test.step("Launcher.signInFromAnotherTab", () =>
      this.page.evaluate((connection) => window.__iwftAnotherTab__.signsIn(connection), {
        apiUrl: "https://sync.test",
        token: null,
        accountId: SIMULATED_ACCOUNT_ID,
        email: SIMULATED_EMAIL,
        firstName: null,
      }));

  anotherTabHoldsOnboardingRun = (link: string, phase: OnboardingRunPhase): Promise<void> =>
    test.step(`Launcher.anotherTabHoldsOnboardingRun ${phase}`, () =>
      this.page.evaluate(({ link, phase }) => window.__iwftAnotherTab__.holdsOnboardingRun(link, phase), { link, phase }));

  anotherTabCloses = (): Promise<void> =>
    test.step("Launcher.anotherTabCloses", () => this.page.evaluate(() => window.__iwftAnotherTab__.closes()));

  openConsent = (requestId: string): Promise<void> => this.openPage(Routes.connect(requestId));

  openPage = (path: string): Promise<void> =>
    test.step(`Launcher.openPage ${path}`, () => this.page.evaluate((pathname) => window.__iwftRouter__.navigate(pathname), path));

  get consentPage(): ConsentPageObject {
    return new ConsentPageObject(this.testContext);
  }

  get signInPage(): SignInPageObject {
    return new SignInPageObject(this.testContext);
  }

  get revertEmailPage(): RevertEmailPageObject {
    return new RevertEmailPageObject(this.testContext);
  }

  get accountTermsLine(): AccountTermsLinePageObject {
    return new AccountTermsLinePageObject(this.testContext);
  }

  get legalPage(): LegalPagePageObject {
    return new LegalPagePageObject(this.testContext);
  }

  get libraryMoveNotice(): LibraryMoveNoticePageObject {
    return new LibraryMoveNoticePageObject(this.testContext);
  }

  get signOutNotice(): SignOutNoticePageObject {
    return new SignOutNoticePageObject(this.testContext);
  }

  get howToApplyLine(): HowToApplyLinePageObject {
    return new HowToApplyLinePageObject(this.testContext);
  }

  get learnedNotice(): LearnedNoticePageObject {
    return new LearnedNoticePageObject(this.testContext);
  }

  get aboutYouAsk(): AboutYouAskPageObject {
    return new AboutYouAskPageObject(this.testContext);
  }

  get onboardingNextSteps(): OnboardingNextStepsPageObject {
    return new OnboardingNextStepsPageObject(this.testContext);
  }

  get firstOverviewMilestone(): FirstOverviewMilestonePageObject {
    return new FirstOverviewMilestonePageObject(this.testContext);
  }

  createAccountThroughSample = (): Promise<SignInPageObject> => createAccountThroughSample(this.testContext);

  get sampleDeck(): SampleDeckPageObject {
    return new SampleDeckPageObject(this.testContext);
  }

  get onboardingSamples(): OnboardingSamplesPageObject {
    return new OnboardingSamplesPageObject(this.testContext);
  }

  get onboardingPage(): OnboardingPageObject {
    return new OnboardingPageObject(this.testContext);
  }

  get signedOutGate(): SignedOutGatePageObject {
    return new SignedOutGatePageObject(this.testContext);
  }

  get openingLibrary(): OpeningLibraryPageObject {
    return new OpeningLibraryPageObject(this.testContext);
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

  get softWall(): SoftWallPageObject {
    return new SoftWallPageObject(this.testContext);
  }

  get savedItem(): SavedItemPageObject {
    return new SavedItemPageObject(this.testContext);
  }

  get plansModal(): PlansModalPageObject {
    return new PlansModalPageObject(this.testContext);
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

  libraryIsKept = (accountId: string | null): Promise<boolean> =>
    test.step("Launcher.libraryIsKept", () => this.page.evaluate((id) => window.__iwftLibraries__.has(id), accountId));

  launchExpectingLibrary = (options: LaunchOptions = {}): Promise<LibraryPageObject> =>
    test.step("Launcher.launchExpectingLibrary", async () => {
      const home = await this.launch(options);
      return home.verifyShowsLibrary();
    });
}

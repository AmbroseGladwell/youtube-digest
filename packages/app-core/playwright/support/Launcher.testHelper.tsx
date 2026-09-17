import { test, type ComponentFixtures } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import type { TestContext } from "./TestContext.testHelper.js";
import { IwftAppRoot } from "./IwftAppRoot.testHelper.js";
import { HomePageObject } from "../pageObjects/HomePageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "../pageObjects/GenerateOverviewFormPageObject.testHelper.js";
import { LibraryPageObject } from "../pageObjects/LibraryPageObject.testHelper.js";
import { AppShellPageObject } from "../pageObjects/AppShellPageObject.testHelper.js";
import { ReaderPageObject } from "../pageObjects/ReaderPageObject.testHelper.js";

export interface LaunchOptions {
  apiKeys?: ApiKeys;
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

  launch = (options: LaunchOptions = {}): Promise<HomePageObject> =>
    test.step("Launcher.launch", async () => {
      await this.backendSimulator.handleNetworking();
      await this.mount(<IwftAppRoot />, {
        hooksConfig: { ...this.backendSimulator.buildHooksConfig(), apiKeys: options.apiKeys },
      });
      return new HomePageObject(this.testContext).verifyIsShown();
    });

  launchExpectingFirstRun = (options: LaunchOptions = {}): Promise<GenerateOverviewFormPageObject> =>
    test.step("Launcher.launchExpectingFirstRun", async () => {
      const home = await this.launch(options);
      await home.verifyShowsFirstRunHero();
      return this.appShell.openNewOverview();
    });

  get appShell(): AppShellPageObject {
    return new AppShellPageObject(this.testContext);
  }

  get readerPage(): ReaderPageObject {
    return new ReaderPageObject(this.testContext);
  }

  launchExpectingLibrary = (options: LaunchOptions = {}): Promise<LibraryPageObject> =>
    test.step("Launcher.launchExpectingLibrary", async () => {
      const home = await this.launch(options);
      return home.verifyShowsLibrary();
    });
}

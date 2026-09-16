import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import type { TestContext } from "../support/TestContext.testHelper.js";

export abstract class PageObject {
  protected readonly name: string;

  constructor(
    readonly testContext: TestContext,
    protected readonly locator?: Locator,
  ) {
    const constructorName = this.constructor.name;
    if (!constructorName.endsWith("PageObject")) {
      throw new Error(`Expected constructor name to end with 'PageObject', but got: ${constructorName}`);
    }
    this.name = constructorName.slice(0, -"PageObject".length);
  }

  get page(): Page {
    return this.testContext.page;
  }

  protected step = <T>(name: string, body: () => T | Promise<T>): Promise<T> =>
    test.step(`${this.name}.${name}`, body);

  protected get = (testId: string): Locator => this.locatorOrPage().getByTestId(testId);
  protected locatorOrPage = (): Locator | Page => this.locator ?? this.page;

  protected click = (target: string | Locator) => this.resolveLocator(target).click();
  protected resolveLocator = (target: string | Locator): Locator =>
    typeof target === "string" ? this.get(target) : target;

  protected expectToBeVisible = (testId: string) => expect(this.get(testId)).toBeVisible();
  protected expectNotToBeVisible = (testId: string) => expect(this.get(testId)).not.toBeVisible();
  protected expectToHaveCount = (testId: string, count: number) => expect(this.get(testId)).toHaveCount(count);
}

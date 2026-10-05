import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import type { TestContext } from "../support/TestContext.testHelper.js";

const TEXT_LIKE_FIELDS =
  "input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=submit]):not([type=button]), textarea, select";

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

  verifyFieldFontSizes = (check: (sizesInPx: number[]) => void) =>
    this.step("verifyFieldFontSizes", async () => {
      const sizes = await this.locatorOrPage()
        .locator("input, textarea, select")
        .evaluateAll((fields) => fields.map((field) => parseFloat(getComputedStyle(field).fontSize)));
      expect(sizes.length).toBeGreaterThan(0);
      check(sizes);
    });

  verifyFieldsIdentifyThemselves = () =>
    this.step("verifyFieldsIdentifyThemselves", async () => {
      const fields = await this.locatorOrPage()
        .locator(TEXT_LIKE_FIELDS)
        .evaluateAll((fields) =>
          fields.map((field) => ({
            field: field.getAttribute("data-testid") ?? field.outerHTML,
            name: field.getAttribute("name") ?? "",
            id: field.id,
            labelled:
              ((field as HTMLInputElement).labels?.length ?? 0) > 0 ||
              field.hasAttribute("aria-label") ||
              field.hasAttribute("aria-labelledby"),
            autocomplete: field.getAttribute("autocomplete") ?? "",
          })),
        );
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.filter((field) => !field.name || !field.id || !field.labelled || !field.autocomplete)).toEqual([]);
      const ids = fields.map((field) => field.id);
      expect(ids).toEqual([...new Set(ids)]);
    });

  verifyFieldAttributes = (name: string, attributes: Record<string, string>) =>
    this.step(`verifyFieldAttributes ${name}`, async () => {
      const named = this.locatorOrPage().locator(`[name="${name}"]`);
      await expect(named.first()).toBeAttached();
      for (const field of await named.all()) {
        for (const [attribute, value] of Object.entries(attributes)) {
          await expect(field).toHaveAttribute(attribute, value);
        }
      }
    });
}

import { expect } from "@playwright/experimental-ct-react";
import { apiKeysPanelTestIds } from "../../src/features/settings/components/ApiKeysPanel/ApiKeysPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ApiKeysPanelPageObject extends PageObject {
  verifyIsShown = (): Promise<ApiKeysPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(apiKeysPanelTestIds.root);
      return this;
    });

  fillAnthropicKey = (value: string) =>
    this.step(`fillAnthropicKey ${value}`, () => this.get(apiKeysPanelTestIds.anthropicInput).fill(value));

  fillSupadataKey = (value: string) =>
    this.step(`fillSupadataKey ${value}`, () => this.get(apiKeysPanelTestIds.supadataInput).fill(value));

  selectModel = (modelId: string) =>
    this.step(`selectModel ${modelId}`, () => this.get(apiKeysPanelTestIds.modelSelect).selectOption(modelId));

  verifySupadataNoteReads = (pattern: RegExp) =>
    this.step(`verifySupadataNoteReads ${pattern.source}`, () =>
      expect(this.get(apiKeysPanelTestIds.supadataNote)).toHaveText(pattern),
    );

  clickSave = () => this.step("clickSave", () => this.click(apiKeysPanelTestIds.saveButton));

  saveKeys = (anthropicApiKey: string, supadataApiKey: string) =>
    this.step("saveKeys", async () => {
      await this.fillAnthropicKey(anthropicApiKey);
      await this.fillSupadataKey(supadataApiKey);
      await this.clickSave();
    });
}

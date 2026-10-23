import { expect } from "@playwright/experimental-ct-react";
import type { Provider } from "@overview/domain";
import { addProviderKeyRowTestIds } from "../../src/features/settings/components/AddProviderKeyRow/AddProviderKeyRowTestIds.js";
import { apiKeysPanelTestIds } from "../../src/features/settings/components/ApiKeysPanel/ApiKeysPanelTestIds.js";
import { onlyMyKeySwitchTestIds } from "../../src/features/settings/components/OnlyMyKeySwitch/OnlyMyKeySwitchTestIds.js";
import { generateWithCardTestIds } from "../../src/features/settings/components/GenerateWithCard/GenerateWithCardTestIds.js";
import { providerKeyRowTestIds } from "../../src/features/settings/components/ProviderKeyRow/ProviderKeyRowTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ApiKeysPanelPageObject extends PageObject {
  verifyIsShown = (): Promise<ApiKeysPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(apiKeysPanelTestIds.root);
      return this;
    });

  openAddKey = (provider: Provider) =>
    this.step(`openAddKey ${provider}`, () => this.click(addProviderKeyRowTestIds.open(provider)));

  fillKey = (provider: Provider, value: string) =>
    this.step(`fillKey ${provider}`, () => this.get(addProviderKeyRowTestIds.input(provider)).fill(value));

  clickSaveKey = (provider: Provider) =>
    this.step(`clickSaveKey ${provider}`, () => this.click(addProviderKeyRowTestIds.save(provider)));

  addKey = (provider: Provider, value: string) =>
    this.step(`addKey ${provider}`, async () => {
      await this.openAddKey(provider);
      await this.fillKey(provider, value);
      await this.clickSaveKey(provider);
    });

  verifyKeyHeld = (provider: Provider) =>
    this.step(`verifyKeyHeld ${provider}`, () => this.expectToBeVisible(providerKeyRowTestIds.root(provider)));

  verifyNoKeyHeld = (provider: Provider) =>
    this.step(`verifyNoKeyHeld ${provider}`, () =>
      expect(this.get(providerKeyRowTestIds.root(provider))).toHaveCount(0),
    );

  verifyInUse = (provider: Provider) =>
    this.step(`verifyInUse ${provider}`, () => this.expectToBeVisible(providerKeyRowTestIds.inUse(provider)));

  verifyGenerateWithReads = (text: string) =>
    this.step(`verifyGenerateWithReads ${text}`, () =>
      expect(this.get(generateWithCardTestIds.choice)).toHaveText(text),
    );

  chooseProvider = (provider: Provider) =>
    this.step(`chooseProvider ${provider}`, () =>
      this.get(generateWithCardTestIds.select).selectOption(provider),
    );

  verifyRefused = (provider: Provider) =>
    this.step(`verifyRefused ${provider}`, () => this.expectToBeVisible(addProviderKeyRowTestIds.problem(provider)));

  verifyOnlyMyKey = (state: boolean | "absent") =>
    this.step(`verifyOnlyMyKey ${state}`, async () => {
      if (state === "absent") await expect(this.get(onlyMyKeySwitchTestIds.root)).toHaveCount(0);
      else await expect(this.get(onlyMyKeySwitchTestIds.switch)).toHaveAttribute("aria-checked", String(state));
    });

  verifyOnlyMyKeyExplains = (pattern: RegExp) =>
    this.step(`verifyOnlyMyKeyExplains ${pattern}`, () =>
      expect(this.get(onlyMyKeySwitchTestIds.explanation)).toHaveText(pattern),
    );

  toggleOnlyMyKey = () => this.step("toggleOnlyMyKey", () => this.click(onlyMyKeySwitchTestIds.switch));

  removeKey = (provider: Provider) =>
    this.step(`removeKey ${provider}`, async () => {
      await this.click(providerKeyRowTestIds.remove(provider));
      await this.click(providerKeyRowTestIds.confirmRemove(provider));
    });

  openModelPicker = (provider: Provider) =>
    this.step(`openModelPicker ${provider}`, () => this.click(providerKeyRowTestIds.model(provider)));

  verifyModelReads = (provider: Provider, label: string) =>
    this.step(`verifyModelReads ${provider} ${label}`, () =>
      expect(this.get(providerKeyRowTestIds.model(provider))).toContainText(label),
    );

  // Design 110g: the choice arrived by sync and the key did not, so the card carries both
  // ways out rather than a control that cannot work.
  verifyNoKeyHereDeadEnd = () =>
    this.step("verifyNoKeyHereDeadEnd", async () => {
      await this.expectToBeVisible(generateWithCardTestIds.missingHeading);
      await this.expectToBeVisible(generateWithCardTestIds.addKey);
      await this.expectToBeVisible(generateWithCardTestIds.useFallback);
    });

  useFallbackKey = () =>
    this.step("useFallbackKey", () => this.click(generateWithCardTestIds.useFallback));

  removeAllKeys = () =>
    this.step("removeAllKeys", async () => {
      await this.click(apiKeysPanelTestIds.removeAll);
      await this.click(apiKeysPanelTestIds.removeAllYes);
    });
}

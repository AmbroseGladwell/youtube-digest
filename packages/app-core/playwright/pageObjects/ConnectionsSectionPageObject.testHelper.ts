import { expect } from "@playwright/experimental-ct-react";
import { connectionRowTestIds } from "../../src/features/connections/components/ConnectionRow/ConnectionRowTestIds.js";
import { connectionsSectionTestIds } from "../../src/features/connections/components/ConnectionsSection/ConnectionsSectionTestIds.js";
import { connectorSetupTestIds } from "../../src/features/connections/components/ConnectorSetup/ConnectorSetupTestIds.js";
import { plusPlanPanelTestIds } from "../../src/features/plus/components/PlusPlanPanel/PlusPlanPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Settings › Connections (docs/features/mcp-connector.md).
export class ConnectionsSectionPageObject extends PageObject {
  verifyListsConnections = (names: string[]) =>
    this.step(`verifyListsConnections ${names.join(", ")}`, () =>
      names.length === 0
        ? this.expectToHaveCount(connectionRowTestIds.root, 0)
        : expect(this.get(connectionRowTestIds.name)).toHaveText(names),
    );

  verifyUseLineReads = (index: number, text: string) =>
    this.step(`verifyUseLineReads ${index} ${text}`, () =>
      expect(this.get(connectionRowTestIds.useLine).nth(index)).toHaveText(text),
    );

  startRevoking = (name: string) =>
    this.step(`startRevoking ${name}`, () => this.page.getByRole("button", { name: `Revoke ${name}` }).click());

  verifyConfirmReads = (title: string) =>
    this.step(`verifyConfirmReads ${title}`, async () => {
      const group = this.page.getByRole("group", { name: title });
      await expect(group).toBeVisible();
      await expect(group.getByText(title)).toBeFocused();
    });

  confirmRevoke = () => this.step("confirmRevoke", () => this.click(connectionRowTestIds.revokeAccessButton));

  keep = () => this.step("keep", () => this.click(connectionRowTestIds.keepButton));

  verifyRevokeIsFocused = (name: string) =>
    this.step(`verifyRevokeIsFocused ${name}`, () =>
      expect(this.page.getByRole("button", { name: `Revoke ${name}` })).toBeFocused(),
    );

  verifyConnectedLabelIsFocused = () =>
    this.step("verifyConnectedLabelIsFocused", () =>
      expect(this.get(connectionsSectionTestIds.connectedLabel)).toBeFocused(),
    );

  verifyShowsSetup = (address: string) =>
    this.step(`verifyShowsSetup ${address}`, async () => {
      await expect(this.get(connectorSetupTestIds.address)).toHaveText(address);
      await this.expectToHaveCount(connectorSetupTestIds.step, 3);
    });

  verifyOffersExamples = (offered: boolean) =>
    this.step(`verifyOffersExamples ${offered}`, () =>
      offered
        ? this.expectToBeVisible(connectionsSectionTestIds.tryAsking)
        : this.expectToHaveCount(connectionsSectionTestIds.tryAsking, 0),
    );

  copyAddress = () => this.step("copyAddress", () => this.click(connectorSetupTestIds.copyButton));

  verifyCopied = () => this.step("verifyCopied", () => this.expectToBeVisible(connectorSetupTestIds.copied));

  verifyOffersPlus = () =>
    this.step("verifyOffersPlus", async () => {
      await this.expectToBeVisible(connectionsSectionTestIds.plusOffer);
      await this.expectToHaveCount(connectorSetupTestIds.root, 0);
    });

  verifyAsksToSignIn = () =>
    this.step("verifyAsksToSignIn", async () => {
      await this.expectToBeVisible(connectionsSectionTestIds.signInFirst);
      await this.expectToHaveCount(connectorSetupTestIds.root, 0);
    });

  verifyErrorShown = () => this.step("verifyErrorShown", () => this.expectToBeVisible(connectionsSectionTestIds.error));

  tryAgain = () =>
    this.step("tryAgain", () => this.get(connectionsSectionTestIds.error).getByRole("button", { name: "Try again" }).click());

  openFromPlusPanel = () => this.step("openFromPlusPanel", () => this.click(plusPlanPanelTestIds.connectionsLink));
}

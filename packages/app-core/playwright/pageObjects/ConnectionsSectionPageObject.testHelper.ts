import { expect } from "@playwright/experimental-ct-react";
import { connectionRowTestIds } from "../../src/features/connections/components/ConnectionRow/ConnectionRowTestIds.js";
import { connectionsSectionTestIds } from "../../src/features/connections/components/ConnectionsSection/ConnectionsSectionTestIds.js";
import { connectorSetupTestIds } from "../../src/features/connections/components/ConnectorSetup/ConnectorSetupTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ConnectionsSectionPageObject extends PageObject {
  verifyListsConnections = (names: string[]) =>
    this.step(`verifyListsConnections ${names.join(", ")}`, () =>
      names.length === 0
        ? this.expectToHaveCount(connectionRowTestIds.root, 0)
        : expect(this.get(connectionRowTestIds.name)).toHaveText(names),
    );

  verifyUseLineReads = (index: number, text: string) =>
    this.step(`verifyUseLineReads ${index} ${text}`, () => expect(this.get(connectionRowTestIds.useLine).nth(index)).toHaveText(text));

  verifyProfileLineReads = (index: number, text: string) =>
    this.step(`verifyProfileLineReads ${index} ${text}`, () =>
      expect(this.get(connectionRowTestIds.profileLine).nth(index)).toHaveText(text),
    );

  verifyWriteLinesRead = (lines: string[]) =>
    this.step(`verifyWriteLinesRead ${lines.join(", ")}`, () => expect(this.get(connectionRowTestIds.writeLine)).toHaveText(lines));

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
    this.step(`verifyRevokeIsFocused ${name}`, () => expect(this.page.getByRole("button", { name: `Revoke ${name}` })).toBeFocused());

  verifyConnectedLabelIsFocused = () =>
    this.step("verifyConnectedLabelIsFocused", () => expect(this.get(connectionsSectionTestIds.connectedLabel)).toBeFocused());

  verifyAsksWhichAssistant = () =>
    this.step("verifyAsksWhichAssistant", async () => {
      await expect(this.page.getByRole("radiogroup", { name: "Your assistant" }).getByRole("radio")).toHaveText([
        "Claude",
        "ChatGPT",
        "Gemini",
        "Other",
      ]);
      await this.expectToHaveCount(connectorSetupTestIds.steps, 0);
    });

  verifyQuestionsPlaceReads = (place: string) =>
    this.step(`verifyQuestionsPlaceReads ${place}`, () =>
      expect(this.page.getByRole("button", { name: /^Questions to ask next for every overview: / })).toHaveAccessibleName(
        `Questions to ask next for every overview: ${place}`,
      ),
    );

  chooseQuestionsPlace = (place: string) =>
    this.step(`chooseQuestionsPlace ${place}`, async () => {
      await this.page.getByRole("button", { name: /^Questions to ask next for every overview: / }).click();
      await this.page
        .getByRole("menu", { name: "Questions to ask next for every overview" })
        .getByRole("menuitemradio", { name: new RegExp(`^${place}`) })
        .click();
    });

  chooseAssistant = (assistant: string) =>
    this.step(`chooseAssistant ${assistant}`, () => this.click(connectorSetupTestIds.assistant(assistant)));

  verifyAssistantChosen = (assistant: string) =>
    this.step(`verifyAssistantChosen ${assistant}`, () =>
      expect(this.get(connectorSetupTestIds.assistant(assistant))).toHaveAttribute("aria-checked", "true"),
    );

  verifyStepsRead = (steps: string[]) =>
    this.step(`verifyStepsRead ${steps.length}`, () =>
      expect(this.get(connectorSetupTestIds.step)).toHaveText(steps.map((step) => new RegExp(`^\\d?${escape(step)}`))),
    );

  verifyAddressIs = (address: string) =>
    this.step(`verifyAddressIs ${address}`, () => expect(this.get(connectorSetupTestIds.address)).toHaveText(address));

  verifyLimitReads = (limit: string | null) =>
    this.step(`verifyLimitReads ${limit}`, () =>
      limit === null
        ? this.expectToHaveCount(connectorSetupTestIds.limit, 0)
        : expect(this.get(connectorSetupTestIds.limit)).toHaveText(limit),
    );

  verifyFieldsRead = (fields: string[]) =>
    this.step(`verifyFieldsRead ${fields.length}`, () =>
      expect(this.get(connectorSetupTestIds.field)).toHaveText(fields.map((field) => new RegExp(`^${escape(field)}`))),
    );

  verifyIconDownloadsFrom = (href: string) =>
    this.step(`verifyIconDownloadsFrom ${href}`, () => expect(this.get(connectorSetupTestIds.downloadIcon)).toHaveAttribute("href", href));

  copyField = (field: string) => this.step(`copyField ${field}`, () => this.click(connectorSetupTestIds.copyField(field)));

  verifyArrivalNoteReads = (note: string | null) =>
    this.step(`verifyArrivalNoteReads ${note}`, () =>
      note === null
        ? this.expectToHaveCount(connectionsSectionTestIds.fromQuestion, 0)
        : expect(this.get(connectionsSectionTestIds.fromQuestion)).toHaveText(note),
    );

  verifyOffersExamples = (offered: boolean) =>
    this.step(`verifyOffersExamples ${offered}`, () =>
      offered
        ? this.expectToBeVisible(connectionsSectionTestIds.tryAsking)
        : this.expectToHaveCount(connectionsSectionTestIds.tryAsking, 0),
    );

  copyAddress = () => this.step("copyAddress", () => this.click(connectorSetupTestIds.copyButton));

  verifyCopied = () => this.step("verifyCopied", () => this.expectToBeVisible(connectorSetupTestIds.copied));

  verifyAsksToSignIn = () =>
    this.step("verifyAsksToSignIn", async () => {
      await this.expectToBeVisible(connectionsSectionTestIds.signInFirst);
      await this.expectToHaveCount(connectorSetupTestIds.root, 0);
    });

  verifyErrorShown = () => this.step("verifyErrorShown", () => this.expectToBeVisible(connectionsSectionTestIds.error));

  tryAgain = () =>
    this.step("tryAgain", () => this.get(connectionsSectionTestIds.error).getByRole("button", { name: "Try again" }).click());
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

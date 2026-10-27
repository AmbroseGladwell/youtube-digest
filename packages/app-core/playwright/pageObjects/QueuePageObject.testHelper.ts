import { expect } from "@playwright/experimental-ct-react";
import { queuePageTestIds } from "../../src/features/captureQueue/QueuePage/QueuePageTestIds.js";
import { attentionRowTestIds } from "../../src/features/captureQueue/components/AttentionRow/AttentionRowTestIds.js";
import { pacedQueueGroupTestIds } from "../../src/features/captureQueue/components/PacedQueueGroup/PacedQueueGroupTestIds.js";
import { queueRowTestIds } from "../../src/features/captureQueue/components/QueueRow/QueueRowTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The capture queue's own page (designs 27j–27m).
export class QueuePageObject extends PageObject {
  verifyIsShown = (): Promise<QueuePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(queuePageTestIds.root);
      await expect(this.get(queuePageTestIds.heading)).toBeFocused();
      return this;
    });

  verifyWaiting = (titles: string[]) =>
    this.step(`verifyWaiting ${titles.join(", ")}`, () =>
      titles.length === 0
        ? this.expectToHaveCount(queuePageTestIds.waiting, 0)
        : expect(this.get(queuePageTestIds.waiting).getByTestId(queueRowTestIds.title)).toHaveText(titles),
    );

  verifyWaitingStatuses = (statuses: string[]) =>
    this.step(`verifyWaitingStatuses ${statuses.join(", ")}`, () =>
      expect(this.get(queuePageTestIds.waiting).getByTestId(queueRowTestIds.status)).toHaveText(statuses),
    );

  verifyAttention = (rows: Array<{ tag: "Failed" | "Skipped"; title: string; reason: string }>) =>
    this.step(`verifyAttention ${rows.map((row) => row.title).join(", ")}`, async () => {
      await expect(this.get(attentionRowTestIds.tag)).toHaveText(rows.map((row) => row.tag));
      await expect(this.get(attentionRowTestIds.title)).toHaveText(rows.map((row) => row.title));
      await expect(this.get(attentionRowTestIds.reason)).toHaveText(rows.map((row) => row.reason));
    });

  verifyNothingWaiting = () => this.step("verifyNothingWaiting", () => this.expectToBeVisible(queuePageTestIds.empty));

  retry = (title: string) =>
    this.step(`retry ${title}`, () => this.page.getByRole("button", { name: `Try “${title}” again` }).click());

  dismiss = (title: string) =>
    this.step(`dismiss ${title}`, () => this.page.getByRole("button", { name: `Dismiss “${title}”` }).click());

  remove = (title: string) =>
    this.step(`remove ${title}`, () => this.page.getByRole("button", { name: `Remove “${title}” from the queue` }).click());

  pause = () => this.step("pause", () => this.click(queuePageTestIds.pauseButton));

  resume = () => this.step("resume", () => this.click(queuePageTestIds.resumeButton));

  clear = () =>
    this.step("clear", async () => {
      await this.click(queuePageTestIds.clearButton);
      await this.expectToBeVisible(queuePageTestIds.clearConfirm);
      await this.click(queuePageTestIds.confirmClearButton);
    });

  verifyNoKeyNote = () => this.step("verifyNoKeyNote", () => this.expectToBeVisible(queuePageTestIds.noKeyNote));

  verifyHeldNoteReads = (text: string | RegExp) =>
    this.step("verifyHeldNoteReads", () => expect(this.get(queuePageTestIds.heldNote)).toHaveText(text));

  verifyHeldNoteIsAbsent = () => this.step("verifyHeldNoteIsAbsent", () => this.expectToHaveCount(queuePageTestIds.heldNote, 0));

  verifyTryAgainIsOffered = (offered: boolean) =>
    this.step(`verifyTryAgainIsOffered ${offered}`, () =>
      offered ? this.expectToBeVisible(attentionRowTestIds.retryButton) : this.expectToHaveCount(attentionRowTestIds.retryButton, 0),
    );

  verifyPauseIsOffered = (offered: boolean) =>
    this.step(`verifyPauseIsOffered ${offered}`, () =>
      offered ? this.expectToBeVisible(queuePageTestIds.pauseButton) : this.expectToHaveCount(queuePageTestIds.pauseButton, 0),
    );

  verifyContinuesTomorrow = (label: string, titles: string[]) =>
    this.step(`verifyContinuesTomorrow ${label}`, async () => {
      await expect(this.get(queuePageTestIds.tomorrowLabel)).toHaveText(label);
      await expect(this.get(queuePageTestIds.tomorrow).getByTestId(queueRowTestIds.title)).toHaveText(titles);
      await expect(this.get(queuePageTestIds.tomorrow).getByTestId(queueRowTestIds.status)).toHaveText(titles.map(() => "Continues tomorrow"));
    });

  verifyNothingContinuesTomorrow = () =>
    this.step("verifyNothingContinuesTomorrow", () => this.expectToHaveCount(queuePageTestIds.tomorrow, 0));

  verifyWaitingForYou = (label: string, titles: string[]) =>
    this.step(`verifyWaitingForYou ${label}`, async () => {
      await expect(this.get(queuePageTestIds.forYouLabel)).toHaveText(label);
      await expect(this.get(queuePageTestIds.forYou).getByTestId(queueRowTestIds.title)).toHaveText(titles);
    });

  verifyPacedGroupMeta = (metas: string[]) =>
    this.step(`verifyPacedGroupMeta ${metas.join(", ")}`, () => expect(this.get(pacedQueueGroupTestIds.meta)).toHaveText(metas));

  makeNow = (title: string) =>
    this.step(`makeNow ${title}`, () => this.page.getByRole("button", { name: `Make “${title}” now` }).click());

  verifyMadeNowNotice = (text: string) =>
    this.step(`verifyMadeNowNotice ${text}`, () => expect(this.get(queuePageTestIds.madeNowNotice)).toHaveText(text));

  startChoosing = () => this.step("startChoosing", () => this.get(queuePageTestIds.chooseButton).first().click());

  choose = (title: string) =>
    this.step(`choose ${title}`, () => this.page.getByRole("checkbox", { name: `Choose “${title}”` }).click());

  verifyChosen = (count: string, line: string) =>
    this.step(`verifyChosen ${count}`, async () => {
      await expect(this.get(queuePageTestIds.chosenCount)).toHaveText(count);
      await expect(this.get(queuePageTestIds.chosenBar)).toContainText(line);
    });

  makeChosenNow = (label: string) =>
    this.step(`makeChosenNow ${label}`, async () => {
      await expect(this.get(queuePageTestIds.makeChosenButton)).toHaveText(label);
      await this.click(queuePageTestIds.makeChosenButton);
    });

  removeChosen = () => this.step("removeChosen", () => this.click(queuePageTestIds.removeChosenButton));
}

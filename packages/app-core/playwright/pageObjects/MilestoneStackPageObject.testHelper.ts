import { expect } from "@playwright/experimental-ct-react";
import { milestoneCardTestIds } from "../../src/features/timeSaved/components/MilestoneCard/MilestoneCardTestIds.js";
import { milestoneStackTestIds } from "../../src/features/timeSaved/components/MilestoneStack/MilestoneStackTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class MilestoneStackPageObject extends PageObject {
  verifyShowsNothing = () =>
    this.step("verifyShowsNothing", () => this.expectToHaveCount(milestoneCardTestIds.root, 0));

  verifyFrontCardIs = (label: string) =>
    this.step(`verifyFrontCardIs ${label}`, () =>
      expect(this.get(milestoneCardTestIds.pill)).toHaveText(`${label} saved`),
    );

  verifyFigureSays = (spoken: string) =>
    this.step(`verifyFigureSays ${spoken}`, () =>
      expect(this.get(milestoneCardTestIds.figure)).toHaveAttribute("aria-label", spoken),
    );

  verifyCountReads = (count: string) =>
    this.step(`verifyCountReads ${count}`, () => expect(this.get(milestoneStackTestIds.count)).toHaveText(count));

  verifyNoCount = () => this.step("verifyNoCount", () => this.expectNotToBeVisible(milestoneStackTestIds.count));

  verifyDismissIsLabelled = (label: string) =>
    this.step(`verifyDismissIsLabelled ${label}`, () =>
      expect(this.get(milestoneCardTestIds.dismissButton)).toHaveAccessibleName(label),
    );

  verifyLineReads = (line: string) =>
    this.step(`verifyLineReads ${line}`, () => expect(this.get(milestoneCardTestIds.line)).toHaveText(line));

  clickDot = (index: number) => this.step(`clickDot ${index}`, () => this.click(milestoneCardTestIds.dot(index)));

  pressArrow = (key: "ArrowRight" | "ArrowLeft") =>
    this.step(`pressArrow ${key}`, async () => {
      await this.get(milestoneCardTestIds.root).focus();
      await this.page.keyboard.press(key);
    });

  dismiss = () => this.step("dismiss", () => this.click(milestoneCardTestIds.dismissButton));

  verifyOffersUndo = () => this.step("verifyOffersUndo", () => this.expectToBeVisible(milestoneStackTestIds.undoNote));

  undo = () => this.step("undo", () => this.click(milestoneStackTestIds.undoButton));
}

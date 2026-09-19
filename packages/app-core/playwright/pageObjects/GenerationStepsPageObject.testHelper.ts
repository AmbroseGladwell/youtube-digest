import { expect } from "@playwright/experimental-ct-react";
import { generationStepsTestIds } from "../../src/features/newOverview/components/GenerationSteps/GenerationStepsTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class GenerationStepsPageObject extends PageObject {
  verifyIsShown = (): Promise<GenerationStepsPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(generationStepsTestIds.root);
      return this;
    });

  verifyStepDetail = (stepNumber: string, detail: string) =>
    this.step(`verifyStepDetail ${stepNumber} ${detail}`, () =>
      expect(this.get(generationStepsTestIds.stepDetail(stepNumber))).toHaveText(detail),
    );

  verifyStepDetailMatches = (stepNumber: string, pattern: RegExp) =>
    this.step(`verifyStepDetailMatches ${stepNumber} ${pattern.source}`, () =>
      expect(this.get(generationStepsTestIds.stepDetail(stepNumber))).toHaveText(pattern),
    );

  verifyStepCountIs = (count: number) =>
    this.step(`verifyStepCountIs ${count}`, () =>
      expect(this.get(generationStepsTestIds.root).getByRole("listitem")).toHaveCount(count),
    );

  verifyStepState = (stepNumber: string, state: "waiting" | "running" | "done") =>
    this.step(`verifyStepState ${stepNumber} ${state}`, () =>
      expect(this.get(generationStepsTestIds.step(stepNumber))).toHaveAttribute(
        "data-state",
        state,
      ),
    );
}

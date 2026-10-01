import { expect } from "@playwright/experimental-ct-react";
import type { MilestoneId } from "@overview/domain";
import { milestoneCardTestIds } from "../../src/features/timeSaved/components/MilestoneCard/MilestoneCardTestIds.js";
import { milestonesSectionTestIds } from "../../src/features/timeSaved/components/MilestonesSection/MilestonesSectionTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class MilestonesSectionPageObject extends PageObject {
  verifyFigureSays = (spoken: string) =>
    this.step(`verifyFigureSays ${spoken}`, () =>
      expect(this.get(milestonesSectionTestIds.figure)).toHaveAttribute("aria-label", spoken),
    );

  verifyCountReads = (count: string) =>
    this.step(`verifyCountReads ${count}`, () => expect(this.get(milestonesSectionTestIds.count)).toHaveText(count));

  verifyNextReads = (text: string) =>
    this.step(`verifyNextReads ${text}`, () => expect(this.get(milestonesSectionTestIds.next)).toContainText(text));

  verifyProgress = (label: string, now: number, min: number, max: number) =>
    this.step(`verifyProgress ${label}`, async () => {
      const bar = this.get(milestonesSectionTestIds.next).getByRole("progressbar", { name: label });
      await expect(bar).toHaveAttribute("aria-valuenow", String(now));
      await expect(bar).toHaveAttribute("aria-valuemin", String(min));
      await expect(bar).toHaveAttribute("aria-valuemax", String(max));
    });

  verifyTileIsNamed = (id: MilestoneId, name: string) =>
    this.step(`verifyTileIsNamed ${id} ${name}`, () =>
      expect(this.get(milestonesSectionTestIds.tile(id))).toHaveAccessibleName(name),
    );

  verifyTileState = (id: MilestoneId, state: "reached" | "next" | "ahead") =>
    this.step(`verifyTileState ${id} ${state}`, () =>
      expect(this.get(milestonesSectionTestIds.tile(id))).toHaveAttribute("data-state", state),
    );

  verifyTileIsPicked = (id: MilestoneId, picked: boolean) =>
    this.step(`verifyTileIsPicked ${id} ${picked}`, () =>
      expect(this.get(milestonesSectionTestIds.tile(id))).toHaveAttribute("aria-pressed", String(picked)),
    );

  verifyTileCannotBePicked = (id: MilestoneId) =>
    this.step(`verifyTileCannotBePicked ${id}`, async () => {
      const tile = this.get(milestonesSectionTestIds.tile(id));
      await expect(tile).toHaveAttribute("aria-disabled", "true");
      await expect(tile).not.toHaveAttribute("aria-pressed");
    });

  pickTile = (id: MilestoneId) => this.step(`pickTile ${id}`, () => this.click(milestonesSectionTestIds.tile(id)));

  // Playwright will not click an aria-disabled control, so this presses it the way a reader can.
  pressUnreachedTile = (id: MilestoneId) =>
    this.step(`pressUnreachedTile ${id}`, () => this.get(milestonesSectionTestIds.tile(id)).click({ force: true }));

  verifyCardPillReads = (text: string) =>
    this.step(`verifyCardPillReads ${text}`, () =>
      expect(this.get(milestonesSectionTestIds.card).getByTestId(milestoneCardTestIds.pill)).toHaveText(text),
    );

  verifyCardCannotBeDismissed = () =>
    this.step("verifyCardCannotBeDismissed", () =>
      expect(this.get(milestonesSectionTestIds.card).getByTestId(milestoneCardTestIds.dismissButton)).toHaveCount(0),
    );

  verifyNoCard = () => this.step("verifyNoCard", () => this.expectToHaveCount(milestonesSectionTestIds.card, 0));

  verifyCardsSwitchIs = (on: boolean) =>
    this.step(`verifyCardsSwitchIs ${on}`, async () => {
      const toggle = this.page.getByRole("switch", { name: "Show milestone cards" });
      await expect(toggle).toHaveAttribute("aria-checked", String(on));
    });

  clickCardsSwitch = () => this.step("clickCardsSwitch", () => this.click(milestonesSectionTestIds.cardsSwitch));
}

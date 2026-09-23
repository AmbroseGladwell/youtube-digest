import type { Overview } from "@overview/domain";
import { NOVELTY_LABEL } from "../../overviews/noveltyLabel.js";
import { SELLING_LABEL } from "../../overviews/sellingLabel.js";
import { WATCH_ANYWAY_LABEL } from "../../overviews/watchAnywayLabel.js";
import type { NoteLine } from "../types/NoteLine.js";

export const SUMMARY_SECTION = "Summary";
export const KEY_POINTS_SECTION = "Key points";
export const HOW_TO_APPLY_SECTION = "How to apply";

export function overviewNoteLines(overview: Overview): NoteLine[] {
  const lines: NoteLine[] = [];

  const section = (name: string, heading: string, bodies: string[], bullet = false) => {
    if (bodies.length === 0) {
      return;
    }
    lines.push({ section: name, heading: true, bullet: false, text: heading });
    for (const text of bodies) {
      lines.push({ section: name, heading: false, bullet, text });
    }
  };

  section(SUMMARY_SECTION, "In one line", [overview.inOneLine]);
  section("Core claim", overview.thin ? "No clear claim" : "Core claim", [overview.coreClaim]);

  if (overview.verdict) {
    section("Verdict", "Verdict", [
      `${NOVELTY_LABEL[overview.verdict.novelty]}.`,
      overview.verdict.reasoning,
    ]);
  }

  section(KEY_POINTS_SECTION, KEY_POINTS_SECTION, overview.keyPoints, true);
  section(HOW_TO_APPLY_SECTION, HOW_TO_APPLY_SECTION, overview.howToApply?.items ?? [], true);

  if (overview.selling && overview.selling.type !== "none") {
    section("What it sells", "What it sells", [
      `${SELLING_LABEL[overview.selling.type]}. ${overview.selling.detail}`.trim(),
    ]);
  }

  if (overview.watchAnyway) {
    section("Watch it anyway?", "Watch it anyway?", [
      `${WATCH_ANYWAY_LABEL[overview.watchAnyway.answer]}. ${overview.watchAnyway.reason}`.trim(),
    ]);
  }

  return lines;
}

export function noteSectionNames(lines: NoteLine[]): string[] {
  return [...new Set(lines.map((line) => line.section))];
}

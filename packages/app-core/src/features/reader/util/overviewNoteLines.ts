import type { Overview } from "@overview/types";
import { NOVELTY_LABEL } from "../../overviews/noveltyLabel.js";
import { SELLING_LABEL } from "../../overviews/sellingLabel.js";
import { WATCH_ANYWAY_LABEL } from "../../overviews/watchAnywayLabel.js";
import type { NoteLine } from "../types/NoteLine.js";

export const SUMMARY_SECTION = "Summary";

export function overviewNoteLines(overview: Overview): NoteLine[] {
  const lines: NoteLine[] = [];

  const section = (name: string, heading: string, bodies: string[]) => {
    if (bodies.length === 0) {
      return;
    }
    lines.push({ section: name, heading: true, text: heading });
    for (const text of bodies) {
      lines.push({ section: name, heading: false, text });
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

  section("Key points", "Key points", overview.keyPoints);
  section("How to apply", "How to apply", overview.howToApply?.items ?? []);

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

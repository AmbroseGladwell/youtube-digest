import test from "node:test";
import assert from "node:assert/strict";
import { ProjectId } from "./Brands.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import type { Overview } from "./Overview.js";
import type { Project } from "./Project.js";
import { projectMarkdown, projectOrder, verdictSpread, verdictSpreadLine, type ProjectOverview } from "./projectMarkdown.js";
import type { Novelty } from "./Verdict.js";

const project: Project = {
  id: ProjectId.parse("7a1d3c1e-5d0a-4b8e-9d55-0d1f6a0f2b11"),
  name: "Kitchen renovation",
  purpose: "Choosing a layout and a budget for a small galley kitchen.",
  createdAt: "2026-11-12T09:00:00.000Z",
  createdBy: { by: "reader" },
  purposeBy: { by: "reader" },
  archivedAt: null,
};

const judged = (novelty: Novelty, dubious = false, overrides: Partial<Overview> = {}): Overview =>
  makeOverview({
    verdict: { novelty, standsOut: null, dubious, dubiousClaims: null, reasoning: "Because.", similarTo: [] },
    ...overrides,
  });

const item = (overview: Overview, overrides: Partial<ProjectOverview> = {}): ProjectOverview => ({
  overview,
  read: true,
  addedBy: { by: "reader" },
  ...overrides,
});

test("fresher verdicts come first, then the newest saved, and overviews without a verdict last", () => {
  const unjudged = makeOverview({ savedAt: "2026-11-10T00:00:00.000Z" });
  const common = judged("common_knowledge", false, { savedAt: "2026-11-11T00:00:00.000Z" });
  const olderOriginal = judged("original", false, { savedAt: "2026-11-01T00:00:00.000Z" });
  const newerOriginal = judged("original", false, { savedAt: "2026-11-09T00:00:00.000Z" });
  const fresh = judged("fresh_angle");

  const ordered = projectOrder([unjudged, common, olderOriginal, fresh, newerOriginal].map((overview) => item(overview)));

  assert.deepEqual(
    ordered.map(({ overview }) => overview.id),
    [newerOriginal.id, olderOriginal.id, fresh.id, common.id, unjudged.id],
  );
});

test("the verdict spread counts each level and the dubious ones, in code", () => {
  const spread = verdictSpread([judged("original"), judged("common_knowledge", true), judged("common_knowledge"), makeOverview()]);

  assert.deepEqual(spread, { original: 1, fresh_angle: 0, common_knowledge: 2, unjudged: 1, dubious: 1 });
  assert.equal(verdictSpreadLine(spread), "1 original, 2 widely covered, 1 without a verdict · 1 dubious");
});

test("the brief opens with the purpose, counts the whole project, flags dubious, unread and an assistant's adds", () => {
  const dubious = judged("fresh_angle", true, { howToApply: { items: ["Measure the room first."] } });
  const plain = judged("common_knowledge");

  const text = projectMarkdown(project, [
    item(dubious, { read: false, addedBy: { by: "assistant", connectionId: "conn-1", name: "Claude" } }),
    item(plain),
  ]);

  assert.match(text, /^# Kitchen renovation\n\nPurpose: Choosing a layout/);
  assert.match(text, /2 overview\(s\) · 1 unread · 1 fresh angle, 1 widely covered · 1 dubious/);
  assert.match(text, new RegExp(`Fresh angle, dubious · unread · added by Claude · saved \\S+ · id ${dubious.id}`));
  assert.ok(text.includes(`### ${dubious.source.title} (id ${dubious.id})\n- Measure the room first.`));
  assert.ok(!text.includes(`(id ${plain.id})`));
});

test("a project without a purpose tells the assistant to ask what it is for", () => {
  const text = projectMarkdown({ ...project, purpose: null }, []);

  assert.ok(text.includes("No purpose given. Ask the reader what this project is for"));
  assert.ok(text.includes("0 overview(s) · 0 unread"));
  assert.ok(!text.includes("## Overviews"));
});

test("a page lists only its overviews and their steps, and still counts the whole project", () => {
  const overviews = [judged("original"), judged("fresh_angle"), judged("common_knowledge")].map((overview) =>
    item({ ...overview, howToApply: { items: [`Step for ${overview.id}`] } }),
  );

  const text = projectMarkdown(project, overviews, { from: 1, count: 1 });

  assert.ok(text.includes("3 overview(s)"));
  assert.ok(text.includes(`Step for ${overviews[1]!.overview.id}`));
  assert.ok(!text.includes(`Step for ${overviews[0]!.overview.id}`));
  assert.ok(!text.includes(`Step for ${overviews[2]!.overview.id}`));
});

test("an archived project says when it was archived, and who made it", () => {
  const text = projectMarkdown(
    { ...project, archivedAt: "2026-11-20T00:00:00.000Z", createdBy: { by: "assistant", connectionId: "conn-1", name: "Claude" } },
    [],
  );

  assert.ok(text.includes("Made by Claude on 2026-11-12 · archived 2026-11-20"));
});

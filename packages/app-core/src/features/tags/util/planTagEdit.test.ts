import { describe, expect, it } from "vitest";
import { makeOverviewWithState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { applyTagEditPlan, planTagEdit } from "./planTagEdit.js";

describe("planTagEdit", () => {
  const saas = makeOverviewWithState({ tags: ["saas", "pricing"] });
  const microSaas = makeOverviewWithState({ tags: ["micro-saas", "saas"] });
  const userTagged = makeOverviewWithState({ tags: ["energy"] }, { userTags: ["micro-saas"] });
  const untouched = makeOverviewWithState({ tags: ["energy"] });
  const library = [saas, microSaas, userTagged, untouched];

  it("merging rewrites only the notes carrying a merged tag, and records where each went", () => {
    const { apply, overviewsChanged } = planTagEdit(library, {}, { from: ["saas", "micro-saas"], to: "saas" });

    expect(apply.writes).toEqual([
      { overviewId: microSaas.overview.id, tags: ["saas"] },
      { overviewId: userTagged.overview.id, userTags: ["saas"] },
    ]);
    expect(apply.aliases).toEqual({ "micro-saas": "saas" });
    expect(overviewsChanged).toBe(2);
  });

  it("deleting takes the tag off and blocks it", () => {
    const { apply } = planTagEdit(library, {}, { from: ["pricing"], to: null });

    expect(apply.writes).toEqual([{ overviewId: saas.overview.id, tags: ["saas"] }]);
    expect(apply.aliases).toEqual({ pricing: null });
  });

  it("undo writes back exactly what each note and the aliases held before", () => {
    const { apply, undo } = planTagEdit(library, { nuclear: null }, { from: ["micro-saas"], to: "software" });

    const undone = library.map((entry) => applyTagEditPlan(applyTagEditPlan(entry, apply), undo));

    expect(undone).toEqual(library);
    expect(undo.aliases).toEqual({ nuclear: null });
  });
});

import { describe, expect, it } from "vitest";
import type { Overview, ProjectMember } from "@overview/domain";
import { savedCaptureFrom } from "../../captures/types/SavedCaptureFactory.testHelper.js";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../projects/types/ProjectFactory.testHelper.js";
import { makeTopic } from "../../overviews/types/TopicFactory.testHelper.js";
import { atQueryOf, markedPieces, pickerTitleOf, sourcePickerOptions } from "./sourcePickerOptions.js";

const titled = (title: string, savedAt: string): Overview => {
  const overview = makeOverview({ savedAt });
  overview.source.title = title;
  return overview;
};

describe("sourcePickerOptions", () => {
  const dinner = { ...makeProject({ name: "Dinner Recipes" }), archivedAt: null };
  const old = titled("Chorizo & chickpea soup", "2026-11-01T09:00:00.000Z");
  const overviews = [old, ...Array.from({ length: 5 }, (_, index) => titled(`Talk ${index}`, `2026-11-1${index}T09:00:00.000Z`))];
  const members: ProjectMember[] = [
    makeProjectMember(dinner, old.id),
    makeProjectMember(dinner, overviews[1]!.id, { removedAt: "2026-11-12T09:00:00.000Z" }),
  ];

  it("shows projects with their counts, then the four most recent overviews, never one excluded", () => {
    const { options } = sourcePickerOptions({
      query: "",
      projects: [dinner],
      members,
      overviews,
      saved: [],
      exclude: new Set([overviews[5]!.id]),
    });
    expect(options.map((option) => (option.kind === "project" ? `${option.project.name} ${option.count}` : pickerTitleOf(option)))).toEqual(
      ["Dinner Recipes 1", "Talk 3", "Talk 2", "Talk 1", "Talk 0"],
    );
  });

  it("filters by every typed word in a title or project name", () => {
    const { options } = sourcePickerOptions({ query: "chick soup", projects: [dinner], members, overviews, saved: [], exclude: new Set() });
    expect(options.map((option) => (option.kind === "overview" ? option.overview.source.title : ""))).toEqual(["Chorizo & chickpea soup"]);
    expect(
      sourcePickerOptions({ query: "recipes", projects: [dinner], members, overviews, saved: [], exclude: new Set() }).options[0]?.kind,
    ).toBe("project");
  });

  it("finds an item saved without an overview by its title, among overviews by date, but never as a recent one", () => {
    const saved = [savedCaptureFrom(titled("Chicken soup, slowly", "2026-11-20T09:00:00.000Z"))];
    const found = sourcePickerOptions({ query: "soup", projects: [], members: [], overviews, saved, exclude: new Set() }).options;
    expect(found.map((option) => `${option.kind} ${pickerTitleOf(option)}`)).toEqual([
      "saved Chicken soup, slowly",
      "overview Chorizo & chickpea soup",
    ]);
    expect(
      sourcePickerOptions({ query: "", projects: [], members: [], overviews, saved, exclude: new Set() }).options.some(
        (option) => option.kind === "saved",
      ),
    ).toBe(false);
  });

  it("shows the first eight of many, and says how many more", () => {
    const many = Array.from({ length: 11 }, (_, index) => titled(`Sleep ${index}`, `2026-10-${10 + index}T09:00:00.000Z`));
    const { options, more } = sourcePickerOptions({
      query: "sleep",
      projects: [],
      members: [],
      overviews: many,
      saved: [],
      exclude: new Set(),
    });
    expect(options).toHaveLength(8);
    expect(more).toBe(3);
  });
});

describe("markedPieces and atQueryOf", () => {
  it("marks each typed word where it appears", () => {
    expect(markedPieces("Chorizo & chickpea soup", "chick")).toEqual([
      { text: "Chorizo & ", marked: false },
      { text: "chick", marked: true },
      { text: "pea soup", marked: false },
    ]);
  });

  it("finds the @ at the caret only at a word's start", () => {
    expect(atQueryOf("How does @chori", 15)).toEqual({ start: 9, query: "chori" });
    expect(atQueryOf("me@example", 10)).toBeNull();
    expect(atQueryOf("no at here", 10)).toBeNull();
  });
});

describe("sourcePickerOptions, topics", () => {
  const cooking = makeTopic({ name: "Cooking" });
  const empty = makeTopic({ name: "Empty" });
  const soup = { ...titled("Chorizo soup", "2026-11-01T09:00:00.000Z"), topicIds: [cooking.id] };
  const talk = titled("A talk", "2026-11-02T09:00:00.000Z");

  it("offers each topic that holds something, with its count, after the projects and before the overviews", () => {
    const { options } = sourcePickerOptions({
      query: "",
      projects: [],
      members: [],
      topics: [cooking, empty],
      overviews: [soup, talk],
      saved: [],
      exclude: new Set(),
    });
    expect(
      options.map((option) => (option.kind === "topic" ? `topic ${option.topic.name} ${option.count}` : pickerTitleOf(option))),
    ).toEqual(["topic Cooking 1", "A talk", "Chorizo soup"]);
  });

  it("matches a topic by its name, and leaves out one already pinned", () => {
    const query = { query: "cook", projects: [], members: [], topics: [cooking], overviews: [soup, talk], saved: [] };
    expect(sourcePickerOptions({ ...query, exclude: new Set() }).options.map((option) => option.kind)).toEqual(["topic"]);
    expect(sourcePickerOptions({ ...query, exclude: new Set([cooking.id]) }).options).toEqual([]);
  });
});

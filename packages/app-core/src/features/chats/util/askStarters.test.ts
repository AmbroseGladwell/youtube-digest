import { describe, expect, it } from "vitest";
import type { Overview } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../overviews/types/TopicFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../projects/types/ProjectFactory.testHelper.js";
import { askStarters } from "./askStarters.js";

describe("askStarters", () => {
  const food = makeTopic({ name: "Food" });
  const overviews: Overview[] = Array.from({ length: 4 }, () => makeOverview({ topicIds: [food.id] }));
  const entries = overviews.map((overview, index) => ({ overview, read: index === 0 }));
  const dinner = makeProject({ name: "Dinner Recipes", purpose: "Yummy dinners for the family", archivedAt: null });
  const members = overviews.slice(0, 3).map((overview) => makeProjectMember(dinner, overview.id));

  it("asks about the library's biggest topic, its biggest project and what's unread, counted by code", () => {
    expect(askStarters({ overviews: entries, projects: [dinner], members, topics: [food] }, null)).toEqual([
      "What do my Food overviews agree on, and where do they differ?",
      "What are the key ideas in my Dinner Recipes project?",
      "What's worth reading first in my 3 unread overviews?",
    ]);
  });

  it("fills in from plain questions when the library is small", () => {
    expect(askStarters({ overviews: entries.slice(0, 1), projects: [], members: [], topics: [food] }, null)).toEqual([
      "What are the big themes across everything I've saved?",
      "Which ideas come up again and again in my overviews?",
      "What have I saved that I could act on this week?",
    ]);
  });

  it("asks about a project from what it's for, its overviews and what's unread in it", () => {
    expect(askStarters({ overviews: entries, projects: [dinner], members, topics: [food] }, dinner)).toEqual([
      "Given what this project is for, what should I do first?",
      "Where do the overviews in Dinner Recipes disagree?",
      "What do the 2 unread overviews here add?",
    ]);
    expect(askStarters({ overviews: entries, projects: [dinner], members: [], topics: [] }, { ...dinner, purpose: null })).toEqual([
      "What are the key ideas in this project?",
      "What should I take from this project, in a few steps?",
      "What's missing from this project?",
    ]);
  });
});

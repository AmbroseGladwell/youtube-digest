import { describe, expect, it } from "vitest";
import { bulkActionToast } from "./bulkActionToast.js";

describe("bulkActionToast", () => {
  it("says what was done to how many", () => {
    expect(bulkActionToast({ kind: "read", overviews: 3 }, { writes: 2, failed: 0 })).toEqual({ text: "3 marked read", done: true });
    expect(bulkActionToast({ kind: "unread", overviews: 1 }, { writes: 1, failed: 0 }).text).toBe("1 marked unread");
    expect(bulkActionToast({ kind: "favourite", overviews: 2 }, { writes: 2, failed: 0 }).text).toBe("2 added to favourites");
    expect(bulkActionToast({ kind: "unfavourite", overviews: 2 }, { writes: 2, failed: 0 }).text).toBe("2 removed from favourites");
    expect(bulkActionToast({ kind: "deleted", overviews: 4 }, { writes: 4, failed: 0 }).text).toBe("4 deleted");
  });

  it("names the place they went to or came from", () => {
    expect(bulkActionToast({ kind: "added", overviews: 3, place: "Cooking" }, { writes: 2, failed: 0 }).text).toBe("Added 3 to Cooking");
    expect(bulkActionToast({ kind: "removed", overviews: 2, place: "Cooking" }, { writes: 2, failed: 0 }).text).toBe(
      "Removed 2 from Cooking",
    );
    expect(bulkActionToast({ kind: "updated", places: 2, noun: "topic" }, { writes: 5, failed: 0 }).text).toBe("Updated 2 topics");
    expect(bulkActionToast({ kind: "updated", places: 1, noun: "project" }, { writes: 1, failed: 0 }).text).toBe("Updated 1 project");
  });

  it("says how many of the writes failed, rather than that it was done", () => {
    expect(bulkActionToast({ kind: "read", overviews: 3 }, { writes: 3, failed: 1 })).toEqual({
      text: "Couldn’t mark 1 of 3 read",
      done: false,
    });
    expect(bulkActionToast({ kind: "deleted", overviews: 4 }, { writes: 4, failed: 4 }).text).toBe("Couldn’t delete 4 of 4");
    expect(bulkActionToast({ kind: "added", overviews: 3, place: "Cooking" }, { writes: 3, failed: 2 }).text).toBe(
      "Couldn’t add 2 of 3 to Cooking",
    );
    expect(bulkActionToast({ kind: "updated", places: 2, noun: "project" }, { writes: 5, failed: 1 }).text).toBe(
      "Couldn’t make 1 of 5 changes",
    );
  });
});

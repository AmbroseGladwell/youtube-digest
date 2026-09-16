import test from "node:test";
import assert from "node:assert/strict";
import type { DigestStore, NoteQuery, ClaimSummary } from "./DigestStore.js";
import type { Note } from "./Note.js";
import type { Topic } from "./Topic.js";
import { DEFAULT_NOTE_STATE, type NoteState } from "./NoteState.js";

// Test-only reference implementation, not exported - real stores live elsewhere.
class InMemoryDigestStore implements DigestStore {
  #notes = new Map<string, Note>();
  #topics = new Map<string, Topic>();
  #states = new Map<string, NoteState>();

  async getNote(id: string) {
    return this.#notes.get(id) ?? null;
  }

  async listNotes(query: NoteQuery = {}) {
    return [...this.#notes.values()].filter((note) => {
      if (query.unsorted) return note.topicIds.length === 0;
      if (query.topicId) return note.topicIds.includes(query.topicId);
      return true;
    });
  }

  async saveNote(note: Note) {
    this.#notes.set(note.id, note);
  }

  async deleteNote(id: string) {
    this.#notes.delete(id);
  }

  async listClaims(): Promise<ClaimSummary[]> {
    return [...this.#notes.values()].map((note) => ({
      noteId: note.id,
      title: note.video.title,
      claim: note.coreClaim,
    }));
  }

  async listTopics() {
    return [...this.#topics.values()];
  }

  async createTopic(input: { name: string; description?: string }) {
    const topic: Topic = {
      id: `topic-${this.#topics.size + 1}`,
      name: input.name,
      description: input.description ?? null,
      createdAt: new Date().toISOString(),
    };
    this.#topics.set(topic.id, topic);
    return topic;
  }

  async getNoteState(noteId: string) {
    return this.#states.get(noteId) ?? { noteId, ...DEFAULT_NOTE_STATE };
  }

  async setNoteState(
    noteId: string,
    patch: Partial<Pick<NoteState, "read" | "favourite" | "userTags">>,
  ) {
    const current = await this.getNoteState(noteId);
    this.#states.set(noteId, { ...current, ...patch });
  }
}

const exampleNote: Note = {
  id: "n1",
  video: {
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: null,
  },
  savedAt: new Date().toISOString(),
  savedNote: null,
  inOneLine: "A short description of the video.",
  coreClaim: "The single assertion this video makes.",
  thin: false,
  keyPoints: ["one", "two", "three"],
  topicIds: [],
  tags: ["one-tag", "two-tag", "three-tag"],
  verdict: null,
  selling: null,
  howToApply: null,
  watchAnyway: null,
};

test("a note with no topics shows up under an unsorted query", async () => {
  const store = new InMemoryDigestStore();
  await store.saveNote(exampleNote);
  const unsorted = await store.listNotes({ unsorted: true });
  assert.equal(unsorted.length, 1);
});

test("filing a note under a topic removes it from the unsorted query", async () => {
  const store = new InMemoryDigestStore();
  await store.saveNote({ ...exampleNote, topicIds: ["fitness"] });
  assert.equal((await store.listNotes({ unsorted: true })).length, 0);
  assert.equal((await store.listNotes({ topicId: "fitness" })).length, 1);
});

test("saveNote replaces the note wholesale but never touches its read/favourite state", async () => {
  const store = new InMemoryDigestStore();
  await store.saveNote(exampleNote);
  await store.setNoteState("n1", { read: true, favourite: true });

  await store.saveNote({ ...exampleNote, coreClaim: "A revised claim after regeneration." });

  const state = await store.getNoteState("n1");
  assert.equal(state.read, true);
  assert.equal(state.favourite, true);
});

test("a user-added tag survives regeneration, because it never lived on the note", async () => {
  const store = new InMemoryDigestStore();
  await store.saveNote(exampleNote);
  await store.setNoteState("n1", { userTags: ["re-watch"] });

  await store.saveNote({ ...exampleNote, tags: ["fresh-tag", "another-tag", "third-tag"] });

  const state = await store.getNoteState("n1");
  assert.deepEqual(state.userTags, ["re-watch"]);
});

test("getNoteState defaults to unread, unfavourited, and no user tags for a note nobody has touched", async () => {
  const store = new InMemoryDigestStore();
  const state = await store.getNoteState("never-seen");
  assert.deepEqual(state, {
    noteId: "never-seen",
    read: false,
    favourite: false,
    userTags: [],
  });
});

test("saving a note with an unfamiliar topicId does not create that topic", async () => {
  const store = new InMemoryDigestStore();
  await store.saveNote({ ...exampleNote, topicIds: ["not-yet-created"] });
  assert.deepEqual(await store.listTopics(), []);
});

test("createTopic is the only way a topic is added to the list", async () => {
  const store = new InMemoryDigestStore();
  const topic = await store.createTopic({ name: "fitness" });
  assert.deepEqual(await store.listTopics(), [topic]);
});

test("listClaims returns a lightweight projection, not full notes", async () => {
  const store = new InMemoryDigestStore();
  await store.saveNote(exampleNote);
  const claims = await store.listClaims();
  assert.deepEqual(claims, [
    { noteId: "n1", title: "Example", claim: "The single assertion this video makes." },
  ]);
});

import type { Note } from "./Note.js";
import type { Topic } from "./Topic.js";
import type { NoteState } from "./NoteState.js";

export interface NoteQuery {
  topicId?: string;
  unsorted?: boolean;
}

export interface ClaimSummary {
  noteId: string;
  title: string;
  claim: string;
}

export interface DigestStore {
  getNote(id: string): Promise<Note | null>;
  listNotes(query?: NoteQuery): Promise<Note[]>;
  saveNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;

  listClaims(): Promise<ClaimSummary[]>;

  listTopics(): Promise<Topic[]>;
  createTopic(input: { name: string; description?: string }): Promise<Topic>;

  getNoteState(noteId: string): Promise<NoteState>;
  setNoteState(
    noteId: string,
    patch: Partial<Pick<NoteState, "read" | "favourite" | "userTags">>,
  ): Promise<void>;
}

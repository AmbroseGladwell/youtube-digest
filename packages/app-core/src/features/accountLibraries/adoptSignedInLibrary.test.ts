import { describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "@overview/domain";
import { readSyncConnection, writeSyncConnection } from "../sync/syncConnectionStorage.js";
import { DEFAULT_SYNC_CONNECTION } from "../sync/types/SyncConnection.js";
import { readReadingPosition, writeReadingPosition } from "../transcripts/readingPositionStorage.js";
import { adoptSignedInLibrary } from "./adoptSignedInLibrary.js";

const makeStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => void data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
};

const SIGNED_IN_BEFORE = { ...DEFAULT_SYNC_CONNECTION, apiUrl: "https://sync.test", email: "ada@example.com" };
const SESSION: SessionInfo = {
  accountId: "account-a",
  email: "ada@example.com",
  firstName: null,
  expiresAt: "2026-11-01T00:00:00.000Z",
  plan: "free",
};

describe("adoptSignedInLibrary", () => {
  it("moves the library of an install signed in before accounts had libraries under that account", async () => {
    const storage = makeStorage();
    writeSyncConnection(SIGNED_IN_BEFORE, storage);
    writeReadingPosition("video1", 65_000, null, storage);
    const moveDatabase = vi.fn(async () => undefined);

    const adopted = await adoptSignedInLibrary({ moveDatabase, storage, readSession: async () => SESSION });

    expect(adopted).toBe("account-a");
    expect(moveDatabase).toHaveBeenCalledWith("account-a");
    expect(readSyncConnection(storage).accountId).toBe("account-a");
    expect(readReadingPosition("video1", "account-a", storage)).toBe(65_000);
    expect(readReadingPosition("video1", null, storage)).toBeNull();
  });

  it("leaves an install that already knows its account, or has none, alone", async () => {
    const moveDatabase = vi.fn(async () => undefined);
    const readSession = vi.fn(async () => SESSION);
    const knows = makeStorage();
    writeSyncConnection({ ...SIGNED_IN_BEFORE, accountId: "account-a" }, knows);
    const signedOut = makeStorage();

    await adoptSignedInLibrary({ moveDatabase, readSession, storage: knows });
    await adoptSignedInLibrary({ moveDatabase, readSession, storage: signedOut });

    expect(readSession).not.toHaveBeenCalled();
    expect(moveDatabase).not.toHaveBeenCalled();
  });

  it("changes nothing when the server can't say whose session it is, and asks again next time", async () => {
    const storage = makeStorage();
    writeSyncConnection(SIGNED_IN_BEFORE, storage);
    const moveDatabase = vi.fn(async () => undefined);

    const refused = await adoptSignedInLibrary({
      moveDatabase,
      storage,
      readSession: () => Promise.reject(new Error("offline")),
    });
    const silent = await adoptSignedInLibrary({
      moveDatabase,
      storage,
      readSession: () => new Promise(() => undefined),
      timeoutMs: 10,
    });

    expect([refused, silent]).toEqual([null, null]);
    expect(moveDatabase).not.toHaveBeenCalled();
    expect(readSyncConnection(storage).accountId).toBeNull();
  });

  it("doesn't overwrite a connection that changed while the library moved", async () => {
    const storage = makeStorage();
    writeSyncConnection(SIGNED_IN_BEFORE, storage);

    await adoptSignedInLibrary({
      storage,
      readSession: async () => SESSION,
      moveDatabase: async () => writeSyncConnection(DEFAULT_SYNC_CONNECTION, storage),
    });

    expect(readSyncConnection(storage)).toEqual(DEFAULT_SYNC_CONNECTION);
  });
});

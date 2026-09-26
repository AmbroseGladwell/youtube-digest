import { describe, expect, it } from "vitest";
import { readSyncConnection, writeSyncConnection } from "./syncConnectionStorage.js";
import { DEFAULT_SYNC_CONNECTION } from "./types/SyncConnection.js";

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

describe("syncConnectionStorage", () => {
  it("is disconnected when nothing has been stored", () => {
    expect(readSyncConnection(makeStorage())).toEqual(DEFAULT_SYNC_CONNECTION);
  });

  it("round-trips a connection", () => {
    const storage = makeStorage();
    writeSyncConnection({ apiUrl: "https://sync.example.com", token: "tok" }, storage);
    expect(readSyncConnection(storage)).toEqual({ apiUrl: "https://sync.example.com", token: "tok" });
  });

  it("is disconnected when what was stored is not a connection", () => {
    const storage = makeStorage();
    storage.setItem("overview.syncConnection.v1", JSON.stringify({ apiUrl: "not a url", token: "tok" }));
    expect(readSyncConnection(storage)).toEqual(DEFAULT_SYNC_CONNECTION);
    storage.setItem("overview.syncConnection.v1", "{not json");
    expect(readSyncConnection(storage)).toEqual(DEFAULT_SYNC_CONNECTION);
  });
});

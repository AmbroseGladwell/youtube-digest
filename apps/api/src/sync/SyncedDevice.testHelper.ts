/// <reference lib="dom" />
import type { FastifyInstance } from "fastify";
import { IDBFactory } from "fake-indexeddb";
import { CLIENT_VERSION } from "@overview/domain";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  IndexedDbSyncStorage,
  IndexedDbTranscriptStore,
  openLocalDatabase,
} from "@overview/store-local";
import { createFetchSyncApi, SyncEngine, type SyncStatus } from "@overview/sync";
import type { TestApp } from "../testing/createTestApp.testHelper.js";
import type { TestAccount } from "../testing/TestAccount.testHelper.js";

// fetch over app.inject(): the client half runs exactly as it would in a browser, against
// the whole API in process, with no port opened (docs/conventions/backend-testing-guide.md).
export function injectingFetch(app: FastifyInstance): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const response = await app.inject({
      method: (init?.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE",
      url: `${url.pathname}${url.search}`,
      headers: init?.headers as Record<string, string>,
      ...(init?.body === undefined ? {} : { payload: init.body as string }),
    });
    return new Response(response.statusCode === 204 ? null : response.body, {
      status: response.statusCode,
      headers: Object.fromEntries(
        Object.entries(response.headers).flatMap(([name, value]) =>
          value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : String(value)]],
        ),
      ),
    });
  };
}

export interface SyncedDevice {
  overviews: IndexedDbOverviewStore;
  settings: IndexedDbSettingsStore;
  transcripts: IndexedDbTranscriptStore;
  storage: IndexedDbSyncStorage;
  engine: SyncEngine;
  sync(): Promise<SyncStatus>;
}

export interface DeviceOptions {
  token?: string;
  clientVersion?: number;
  pageSize?: number;
  // A database that already holds records before sync is switched on.
  before?: (stores: Pick<SyncedDevice, "overviews" | "settings" | "transcripts">) => Promise<void>;
}

// One device: its own IndexedDB, its own stores, its own engine, one account's token.
export async function makeDevice(
  testApp: TestApp,
  account: TestAccount,
  {
    token = account.headers.authorization!.replace(/^Bearer /, ""),
    clientVersion = CLIENT_VERSION,
    pageSize,
    before,
  }: DeviceOptions = {},
): Promise<SyncedDevice> {
  const db = await openLocalDatabase({ indexedDB: new IDBFactory() });
  const storage = new IndexedDbSyncStorage(db, { now: () => testApp.clock.now });
  const overviews = new IndexedDbOverviewStore(db, { onJournaled: storage.notifyJournaled });
  const settings = new IndexedDbSettingsStore(db, { onJournaled: storage.notifyJournaled });
  const transcripts = new IndexedDbTranscriptStore(db);
  await before?.({ overviews, settings, transcripts });
  const engine = new SyncEngine({
    api: createFetchSyncApi({ baseUrl: "http://api.test", token, clientVersion, fetch: injectingFetch(testApp.app) }),
    storage,
    clientVersion,
    pageSize,
    now: () => testApp.clock.now,
  });
  return { overviews, settings, transcripts, storage, engine, sync: () => engine.sync() };
}

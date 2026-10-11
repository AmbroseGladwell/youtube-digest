import { z } from "zod";
import { Provider } from "@overview/domain";

// What one provider last told us its key could reach, and when. Kept on the device beside
// the key that fetched it: it is an answer about that key, and it would be wrong on
// another device holding a different one.
export const ModelCatalogue = z.object({
  usable: z.array(z.string()),
  unusable: z.number().int(),
  fetchedAt: z.iso.datetime(),
});
export type ModelCatalogue = z.infer<typeof ModelCatalogue>;

const Catalogues = z.partialRecord(Provider, ModelCatalogue);
type Catalogues = z.infer<typeof Catalogues>;

const STORAGE_KEY = "overview.modelCatalogues.v1";

// Design 110e: refetched when the picker opens and the list is older than a day. A model
// list is not something a reader should have to ask us to refresh, and it is not something
// worth a call every time the picker opens either.
export const CATALOGUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const catalogueIsStale = (catalogue: ModelCatalogue, now: Date): boolean =>
  now.getTime() - new Date(catalogue.fetchedAt).getTime() > CATALOGUE_MAX_AGE_MS;

export function readCatalogues(storage: Storage = globalThis.localStorage): Catalogues {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return {};
  }
  try {
    const parsed = Catalogues.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function writeCatalogue(
  provider: Provider,
  catalogue: ModelCatalogue,
  storage: Storage = globalThis.localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...readCatalogues(storage), [provider]: catalogue }));
}

export function forgetCatalogue(provider: Provider, storage: Storage = globalThis.localStorage): void {
  const { [provider]: _gone, ...rest } = readCatalogues(storage);
  storage.setItem(STORAGE_KEY, JSON.stringify(rest));
}

export function forgetAllCatalogues(storage: Storage = globalThis.localStorage): void {
  storage.removeItem(STORAGE_KEY);
}

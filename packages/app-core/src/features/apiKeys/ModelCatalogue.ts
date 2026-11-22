import { z } from "zod";
import { Provider } from "@overview/domain";

// Device-local beside its key: an answer about that key, wrong on a device holding another.
export const ModelCatalogue = z.object({
  usable: z.array(z.string()),
  unusable: z.number().int(),
  fetchedAt: z.iso.datetime(),
});
export type ModelCatalogue = z.infer<typeof ModelCatalogue>;

const Catalogues = z.partialRecord(Provider, ModelCatalogue);
type Catalogues = z.infer<typeof Catalogues>;

const STORAGE_KEY = "overview.modelCatalogues.v1";

export const CATALOGUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const catalogueIsStale = (catalogue: ModelCatalogue, now: Date): boolean =>
  now.getTime() - new Date(catalogue.fetchedAt).getTime() > CATALOGUE_MAX_AGE_MS;

export const readCatalogues = (storage: Storage = globalThis.localStorage): Catalogues => {
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
};

export const writeCatalogue = (provider: Provider, catalogue: ModelCatalogue, storage: Storage = globalThis.localStorage): void => {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...readCatalogues(storage), [provider]: catalogue }));
};

export const forgetCatalogue = (provider: Provider, storage: Storage = globalThis.localStorage): void => {
  const { [provider]: _gone, ...rest } = readCatalogues(storage);
  storage.setItem(STORAGE_KEY, JSON.stringify(rest));
};

export const forgetAllCatalogues = (storage: Storage = globalThis.localStorage): void => {
  storage.removeItem(STORAGE_KEY);
};

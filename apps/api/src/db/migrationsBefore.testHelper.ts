import { copyFile, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The migration files below one version, in a directory of their own, so a test can seed
// the shape a migration starts from and then let it run.
export async function migrationsBefore(version: number): Promise<URL> {
  const source = fileURLToPath(new URL("../../migrations/", import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), "migrations-"));
  for (const file of await readdir(source)) {
    if (Number(file.slice(1, 5)) < version) await copyFile(join(source, file), join(dir, file));
  }
  return pathToFileURL(`${dir}/`);
}

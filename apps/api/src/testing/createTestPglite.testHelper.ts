import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

// pgvector is loaded the way Neon has it, so the migrations that create it run here too.
export const createTestPglite = (): PGlite => new PGlite({ extensions: { vector } });

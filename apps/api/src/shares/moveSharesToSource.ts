import { moveVideoToSource, shareContentHash, type SharedNote } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

// The hash moves with the keys: docs/features/source-identity.md, "Shares".
export const moveSharesToSource = async (sql: SqlClient): Promise<void> => {
  const shares = await sql.query<{ token: string; snapshot: { note: unknown } }>(
    "select token, snapshot from shares where snapshot -> 'note' -> 'video' is not null",
  );
  for (const { token, snapshot } of shares) {
    const note = moveVideoToSource(snapshot.note) as SharedNote;
    await sql.query("update shares set snapshot = $2, content_hash = $3 where token = $1", [
      token,
      JSON.stringify({ ...snapshot, note }),
      await shareContentHash(note),
    ]);
  }
};

import { ApiKeysPanel } from "../ApiKeysPanel/ApiKeysPanel.js";

// The panel owns every state this section has now that a key is per provider: adding,
// refusing, removing and choosing all happen on a row rather than behind one Save
// (docs/features/byo-providers.md). Nothing is left for the section to hold.
export function ApiKeysSection() {
  return <ApiKeysPanel />;
}

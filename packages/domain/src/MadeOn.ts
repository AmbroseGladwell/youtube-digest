import { z } from "zod";
import { KeySource } from "./KeySource.js";
import { Provider } from "./Provider.js";

// Why the first key tried couldn't make an overview, so the next one did
// (docs/architecture/tiers.md, "Which key an overview uses").
export const FallbackCause = z.enum(["quota-spent", "out-of-credit", "provider-down", "schema-failure", "busy"]);
export type FallbackCause = z.infer<typeof FallbackCause>;

// Which key made an overview. `fallback` is null when the first key tried made it; when it
// isn't, the reader is told in one quiet line which key was passed over and why. `provider`
// names the reader's provider, whichever side of the fallback their key was on.
export const MadeOn = z.object({
  key: KeySource,
  fallback: z
    .object({
      from: KeySource,
      provider: Provider.nullable(),
      cause: FallbackCause,
    })
    .nullable(),
});
export type MadeOn = z.infer<typeof MadeOn>;

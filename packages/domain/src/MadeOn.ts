import { z } from "zod";
import { KeySource } from "./KeySource.js";
import { Provider } from "./Provider.js";

// docs/architecture/tiers.md, "Which key an overview uses".
export const FallbackCause = z.enum(["quota-spent", "out-of-credit", "provider-down", "schema-failure", "busy"]);
export type FallbackCause = z.infer<typeof FallbackCause>;

// fallback is null when the first key made it; provider is always the reader's own.
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

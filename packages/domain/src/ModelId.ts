import { z } from "zod";

// Never spaces, so nothing shaped like a sentence fits (OV-247).
export const ModelId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/);
export type ModelId = z.infer<typeof ModelId>;

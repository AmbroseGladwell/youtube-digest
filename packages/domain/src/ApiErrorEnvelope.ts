import { z } from "zod";
import { API_ERROR_CODES } from "./ApiErrorCode.js";

// One shape for every failed /api response, on client and server (docs/architecture/api.md).
export const ApiErrorEnvelope = z.object({
  error: z.object({
    code: z.enum(Object.keys(API_ERROR_CODES) as [string, ...string[]]),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelope>;

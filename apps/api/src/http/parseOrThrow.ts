import { z } from "zod";
import { ApiError } from "./ApiError.js";

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("invalid_request", `${what} is not valid`, {
      detail: z.prettifyError(parsed.error),
    });
  }
  return parsed.data;
}

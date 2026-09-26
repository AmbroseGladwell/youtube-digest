import { z } from "zod";
import { ApiError } from "../http/ApiError.js";

const Email = z.email();

export function normaliseEmail(input: string): string {
  const parsed = Email.safeParse(input.trim().toLowerCase());
  if (!parsed.success) {
    throw new ApiError("invalid_request", "That is not an email address");
  }
  return parsed.data;
}

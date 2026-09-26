import { z } from "zod";
import { CLIENT_VERSION } from "@overview/domain";
import { allowedOriginsFromEnv } from "./http/allowedOriginsFromEnv.js";

const ConfigEnv = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3000),
    MIN_SUPPORTED_CLIENT_VERSION: z.coerce.number().int().min(1).default(1),
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ALLOWED_ORIGINS: z.string().optional().transform((value, context) => {
      try {
        return allowedOriginsFromEnv(value);
      } catch (error) {
        context.addIssue({ code: "custom", message: (error as Error).message });
        return z.NEVER;
      }
    }),
  })
  .refine((env) => env.MIN_SUPPORTED_CLIENT_VERSION <= CLIENT_VERSION, {
    path: ["MIN_SUPPORTED_CLIENT_VERSION"],
    message: `above this server's own client version ${CLIENT_VERSION}, so it would refuse the clients it ships with`,
  });

export interface Config {
  databaseUrl: string;
  port: number;
  minSupportedClientVersion: number;
  sessionTtlDays: number;
  allowedOrigins: string[];
}

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = ConfigEnv.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(z.prettifyError(parsed.error));
  }
  return {
    databaseUrl: parsed.data.DATABASE_URL,
    port: parsed.data.PORT,
    minSupportedClientVersion: parsed.data.MIN_SUPPORTED_CLIENT_VERSION,
    sessionTtlDays: parsed.data.SESSION_TTL_DAYS,
    allowedOrigins: parsed.data.CORS_ALLOWED_ORIGINS,
  };
}

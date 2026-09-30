import { z } from "zod";
import { CLIENT_VERSION } from "@overview/domain";
import { allowedOriginsFromEnv } from "./http/allowedOriginsFromEnv.js";

const DEV_APP_URL = "http://localhost:5173";

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
    APP_URL: z.url().default(DEV_APP_URL),
    MAIL_TRANSPORT: z.enum(["log", "brevo"]).default("log"),
    BREVO_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1).optional(),
    STATIC_ROOT: z.string().min(1).optional(),
    TTS_URL: z.url().optional(),
    TTS_CONCURRENCY: z.coerce.number().int().positive().default(5),
    AUDIO_DIR: z.string().min(1).optional(),
  })
  .refine((env) => env.MIN_SUPPORTED_CLIENT_VERSION <= CLIENT_VERSION, {
    path: ["MIN_SUPPORTED_CLIENT_VERSION"],
    message: `above this server's own client version ${CLIENT_VERSION}, so it would refuse the clients it ships with`,
  })
  .refine((env) => env.MAIL_TRANSPORT !== "brevo" || env.BREVO_API_KEY !== undefined, {
    path: ["BREVO_API_KEY"],
    message: "required when MAIL_TRANSPORT is brevo",
  })
  .refine((env) => env.MAIL_TRANSPORT !== "brevo" || env.MAIL_FROM !== undefined, {
    path: ["MAIL_FROM"],
    message: "required when MAIL_TRANSPORT is brevo",
  })
  .refine((env) => env.TTS_URL === undefined || env.AUDIO_DIR !== undefined, {
    path: ["AUDIO_DIR"],
    message: "required when TTS_URL is set: rendered narration has to be kept somewhere",
  })
  .refine((env) => env.MAIL_TRANSPORT !== "brevo" || env.APP_URL.startsWith("https://"), {
    path: ["APP_URL"],
    message: "must be the https address readers will open, when real mail is being sent",
  });

export type MailConfig =
  | { transport: "log" }
  | { transport: "brevo"; brevoApiKey: string; from: string };

// Narration is on only when there is a TTS service to call and somewhere to keep what it
// makes; otherwise /api/audio says it is unavailable (docs/features/tts-pre-rendered-speech.md).
export type AudioConfig = { ttsUrl: string; concurrency: number; audioDir: string } | null;

export interface Config {
  databaseUrl: string;
  port: number;
  minSupportedClientVersion: number;
  sessionTtlDays: number;
  allowedOrigins: string[];
  appUrl: string;
  mail: MailConfig;
  // The built web app to serve outside /api, or null to serve none (docs/architecture/deploy.md).
  staticRoot: string | null;
  audio: AudioConfig;
}

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = ConfigEnv.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(z.prettifyError(parsed.error));
  }
  const { data } = parsed;
  return {
    databaseUrl: data.DATABASE_URL,
    port: data.PORT,
    minSupportedClientVersion: data.MIN_SUPPORTED_CLIENT_VERSION,
    sessionTtlDays: data.SESSION_TTL_DAYS,
    allowedOrigins: data.CORS_ALLOWED_ORIGINS,
    appUrl: data.APP_URL.replace(/\/+$/, ""),
    mail:
      data.MAIL_TRANSPORT === "brevo"
        ? { transport: "brevo", brevoApiKey: data.BREVO_API_KEY!, from: data.MAIL_FROM! }
        : { transport: "log" },
    staticRoot: data.STATIC_ROOT ?? null,
    audio:
      data.TTS_URL === undefined
        ? null
        : { ttsUrl: data.TTS_URL, concurrency: data.TTS_CONCURRENCY, audioDir: data.AUDIO_DIR! },
  };
}

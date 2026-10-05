import { z } from "zod";
import { CLIENT_VERSION } from "@overview/domain";
import type { R2Settings } from "./audio/r2AudioStore.js";
import { allowedOriginsFromEnv } from "./http/allowedOriginsFromEnv.js";
import { OtlpLogsConfigError, otlpLogsConfig, type OtlpLogsConfig } from "./logs/otlpLogsConfig.js";

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
    CLIENT_IP_HEADER: z
      .string()
      .regex(/^[A-Za-z0-9-]+$/, "must be a header name")
      .transform((name) => name.toLowerCase())
      .optional(),
    TTS_URL: z.url().optional(),
    TTS_CONCURRENCY: z.coerce.number().int().positive().default(5),
    AUDIO_DIR: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z.string().regex(/^[0-9a-f]{32}$/).optional(),
    R2_BUCKET: z.string().min(3).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    TRANSCRIPT_SERVICE: z.enum(["off", "on"]).default("off"),
    TRANSCRIPT_PROXY_URL: z
      .url()
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "must be an http(s) proxy")
      .optional(),
    TRANSCRIPT_PROXY_DAILY_FETCHES: z.coerce.number().int().min(0).default(1000),
    YOUTUBE_API_KEY: z.string().min(1).optional(),
    POSTHOG_API_KEY: z.string().min(1).optional(),
    POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
    ANALYTICS_ENVIRONMENT: z.enum(["development", "production"]).default("development"),
    OTEL_LOGS_EXPORTER: z.string().optional(),
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: z.string().min(1).optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).optional(),
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: z.string().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: z.string().optional(),
    OTEL_EXPORTER_OTLP_PROTOCOL: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().min(1).optional(),
    OTEL_RESOURCE_ATTRIBUTES: z.string().optional(),
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
  .refine(
    (env) =>
      env.R2_BUCKET === undefined ||
      [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY].every((value) => value !== undefined),
    { path: ["R2_BUCKET"], message: "requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY" },
  )
  .refine((env) => env.TTS_URL === undefined || env.R2_BUCKET !== undefined || env.AUDIO_DIR !== undefined, {
    path: ["R2_BUCKET"],
    message: "R2 or AUDIO_DIR is required when TTS_URL is set: rendered narration has to be kept somewhere",
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
export type AudioStoreConfig = ({ kind: "r2" } & R2Settings) | { kind: "file"; dir: string };

// Our own server fetching transcripts: off unless asked for, and through the proxy only
// when one is configured (docs/architecture/server-side-transcripts.md).
export type TranscriptServiceConfig = { proxyUrl: string | null; proxyDailyFetches: number } | null;

export type AudioConfig = { ttsUrl: string; concurrency: number; store: AudioStoreConfig } | null;

// Analytics are forwarded only when there is a PostHog project to forward them to;
// otherwise /api/events logs them and stops (docs/architecture/analytics.md).
export type AnalyticsConfig = {
  environment: "development" | "production";
  postHog: { apiKey: string; host: string } | null;
};

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
  clientIpHeader: string | null;
  audio: AudioConfig;
  transcriptService: TranscriptServiceConfig;
  // The YouTube Data API key playlists are read with, or null to read none
  // (docs/features/playlists.md).
  youTubeApiKey: string | null;
  analytics: AnalyticsConfig;
  // Where the server's own log lines are shipped as well as stdout, or null for stdout only.
  logs: OtlpLogsConfig | null;
}

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = ConfigEnv.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(z.prettifyError(parsed.error));
  }
  const { data } = parsed;
  const postHog = data.POSTHOG_API_KEY === undefined ? null : { apiKey: data.POSTHOG_API_KEY, host: data.POSTHOG_HOST };
  let logs: OtlpLogsConfig | null;
  try {
    logs = otlpLogsConfig(data, { postHog, environment: data.ANALYTICS_ENVIRONMENT });
  } catch (error) {
    if (error instanceof OtlpLogsConfigError) throw new ConfigError(error.message);
    throw error;
  }
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
    clientIpHeader: data.CLIENT_IP_HEADER ?? null,
    audio:
      data.TTS_URL === undefined
        ? null
        : {
            ttsUrl: data.TTS_URL,
            concurrency: data.TTS_CONCURRENCY,
            store:
              data.R2_BUCKET === undefined
                ? { kind: "file", dir: data.AUDIO_DIR! }
                : {
                    kind: "r2",
                    accountId: data.R2_ACCOUNT_ID!,
                    bucket: data.R2_BUCKET,
                    accessKeyId: data.R2_ACCESS_KEY_ID!,
                    secretAccessKey: data.R2_SECRET_ACCESS_KEY!,
                  },
          },
    transcriptService:
      data.TRANSCRIPT_SERVICE === "off"
        ? null
        : { proxyUrl: data.TRANSCRIPT_PROXY_URL ?? null, proxyDailyFetches: data.TRANSCRIPT_PROXY_DAILY_FETCHES },
    youTubeApiKey: data.YOUTUBE_API_KEY ?? null,
    analytics: {
      environment: data.ANALYTICS_ENVIRONMENT,
      postHog,
    },
    logs,
  };
}

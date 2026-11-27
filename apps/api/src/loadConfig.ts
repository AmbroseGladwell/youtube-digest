import { z } from "zod";
import { CLIENT_VERSION, ShareToken } from "@overview/domain";
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
    CORS_ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((value, context) => {
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
    TTS_LIVE_SLOTS: z.coerce.number().int().nonnegative().default(1),
    TTS_DOLLARS_PER_MACHINE_HOUR: z.coerce.number().positive().optional(),
    TTS_MODAL_URL: z.url().optional(),
    TTS_MODAL_TOKEN: z.string().min(32).optional(),
    TTS_MODAL_DOLLARS_PER_HOUR: z.coerce.number().positive().optional(),
    TTS_MODAL_MONTHLY_DOLLARS: z.coerce.number().positive().optional(),
    TTS_MODAL_LIVE_SLOTS: z.coerce.number().int().positive().default(6),
    TTS_MODAL_RENDER_SLOTS: z.coerce.number().int().positive().default(4),
    AUDIO_DIR: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .optional(),
    R2_BUCKET: z.string().min(3).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    TRANSCRIPT_SERVICE: z.enum(["off", "on"]).default("off"),
    TRANSCRIPT_PROXY_URL: z
      .url()
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "must be an http(s) proxy")
      .optional(),
    TRANSCRIPT_PROXY_DAILY_FETCHES: z.coerce.number().int().min(0).default(1000),
    STT_URL: z.url().optional(),
    STT_TOKEN: z.string().min(32).optional(),
    STT_CONCURRENCY: z.coerce.number().int().positive().default(10),
    YOUTUBE_API_KEY: z.string().min(1).optional(),
    PODCAST_INDEX_API_KEY: z.string().min(1).optional(),
    PODCAST_INDEX_API_SECRET: z.string().min(1).optional(),
    SCRAPECREATORS_API_KEY: z.string().min(1).optional(),
    SUPPORT_EMAIL: z.email().default("hello@theoverviewapp.com"),
    SAMPLE_SHARE_TOKENS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((token) => token.trim())
          .filter((token) => token !== ""),
      )
      .pipe(z.array(ShareToken)),
    OPENAI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OUR_KEY_DAILY_GENERATIONS: z.coerce.number().int().min(0).default(300),
    OUR_KEY_DAILY_CHAT_MESSAGES: z.coerce.number().int().min(0).default(20_000),
    POSTHOG_API_KEY: z.string().min(1).optional(),
    POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
    POSTHOG_PERSONAL_API_KEY: z.string().min(1).optional(),
    POSTHOG_PROJECT_ID: z.string().regex(/^\d+$/, "must be the project's numeric id").optional(),
    POSTHOG_APP_HOST: z.url().default("https://eu.posthog.com"),
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
  .refine((env) => env.TTS_MODAL_URL === undefined || (env.TTS_URL !== undefined && env.TTS_MODAL_TOKEN !== undefined), {
    path: ["TTS_MODAL_URL"],
    message: "requires TTS_MODAL_TOKEN, and TTS_URL for the Fly pool it falls back to",
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
  // The token alone is allowed so the secret can deploy before the address; the address alone cannot work.
  .refine((env) => env.STT_URL === undefined || env.STT_TOKEN !== undefined, {
    path: ["STT_TOKEN"],
    message: "STT_TOKEN is required when STT_URL is set: the transcriber refuses a call without its token",
  })
  .refine((env) => env.POSTHOG_PERSONAL_API_KEY === undefined || env.POSTHOG_PROJECT_ID !== undefined, {
    path: ["POSTHOG_PROJECT_ID"],
    message: "required when POSTHOG_PERSONAL_API_KEY is set: an erasure has to name the project it acts in",
  })
  .refine((env) => (env.PODCAST_INDEX_API_KEY === undefined) === (env.PODCAST_INDEX_API_SECRET === undefined), {
    path: ["PODCAST_INDEX_API_SECRET"],
    message: "PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET go together: every request is signed with both",
  })
  .refine((env) => env.MAIL_TRANSPORT !== "brevo" || env.APP_URL.startsWith("https://"), {
    path: ["APP_URL"],
    message: "must be the https address readers will open, when real mail is being sent",
  });

export type MailConfig = { transport: "log" } | { transport: "brevo"; brevoApiKey: string; from: string };

export type AudioStoreConfig = ({ kind: "r2" } & R2Settings) | { kind: "file"; dir: string };

export type TranscriptServiceConfig = { proxyUrl: string | null; proxyDailyFetches: number } | null;

export type OurKeyConfig = {
  apiKey: string;
  anthropicApiKey: string | null;
  dailyGenerations: number;
  dailyChatMessages: number;
} | null;

export interface ModalSpeechConfig {
  url: string;
  token: string;
  dollarsPerHour: number | null;
  monthlyDollars: number | null;
  liveSlots: number;
  renderSlots: number;
}

export type AudioConfig = {
  ttsUrl: string;
  concurrency: number;
  liveSlots: number;
  dollarsPerMachineHour: number | null;
  modal: ModalSpeechConfig | null;
  store: AudioStoreConfig;
} | null;

export type SpeechToTextConfig = { url: string; token: string; concurrency: number } | null;

// Why the project id may ship before the key: docs/features/account-deletion.md, "Erasure at PostHog".
export interface AnalyticsConfig {
  environment: "development" | "production";
  postHog: { apiKey: string; host: string } | null;
  erasure: { personalApiKey: string; projectId: string; host: string } | null;
}

export interface Config {
  databaseUrl: string;
  port: number;
  minSupportedClientVersion: number;
  sessionTtlDays: number;
  allowedOrigins: string[];
  appUrl: string;
  mail: MailConfig;
  staticRoot: string | null;
  clientIpHeader: string | null;
  audio: AudioConfig;
  transcriptService: TranscriptServiceConfig;
  speechToText: SpeechToTextConfig;
  ourKey: OurKeyConfig;
  youTubeApiKey: string | null;
  podcastIndex: PodcastIndexKey | null;
  scrapeCreatorsApiKey: string | null;
  sampleShareTokens: ShareToken[];
  supportEmail: string;
  analytics: AnalyticsConfig;
  logs: OtlpLogsConfig | null;
}

export interface PodcastIndexKey {
  apiKey: string;
  apiSecret: string;
}

export class ConfigError extends Error {}

export const loadConfig = (env: Record<string, string | undefined> = process.env): Config => {
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
    if (error instanceof OtlpLogsConfigError) {
      throw new ConfigError(error.message);
    }
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
            liveSlots: Math.min(data.TTS_LIVE_SLOTS, data.TTS_CONCURRENCY - 1),
            dollarsPerMachineHour: data.TTS_DOLLARS_PER_MACHINE_HOUR ?? null,
            modal:
              data.TTS_MODAL_URL === undefined
                ? null
                : {
                    url: data.TTS_MODAL_URL,
                    token: data.TTS_MODAL_TOKEN!,
                    dollarsPerHour: data.TTS_MODAL_DOLLARS_PER_HOUR ?? null,
                    monthlyDollars: data.TTS_MODAL_MONTHLY_DOLLARS ?? null,
                    liveSlots: data.TTS_MODAL_LIVE_SLOTS,
                    renderSlots: data.TTS_MODAL_RENDER_SLOTS,
                  },
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
    speechToText:
      data.STT_URL === undefined || data.STT_TOKEN === undefined
        ? null
        : { url: data.STT_URL, token: data.STT_TOKEN, concurrency: data.STT_CONCURRENCY },
    ourKey:
      data.OPENAI_API_KEY === undefined
        ? null
        : {
            apiKey: data.OPENAI_API_KEY,
            anthropicApiKey: data.ANTHROPIC_API_KEY ?? null,
            dailyGenerations: data.OUR_KEY_DAILY_GENERATIONS,
            dailyChatMessages: data.OUR_KEY_DAILY_CHAT_MESSAGES,
          },
    youTubeApiKey: data.YOUTUBE_API_KEY ?? null,
    podcastIndex:
      data.PODCAST_INDEX_API_KEY === undefined || data.PODCAST_INDEX_API_SECRET === undefined
        ? null
        : { apiKey: data.PODCAST_INDEX_API_KEY, apiSecret: data.PODCAST_INDEX_API_SECRET },
    scrapeCreatorsApiKey: data.SCRAPECREATORS_API_KEY ?? null,
    sampleShareTokens: data.SAMPLE_SHARE_TOKENS,
    supportEmail: data.SUPPORT_EMAIL,
    analytics: {
      environment: data.ANALYTICS_ENVIRONMENT,
      postHog,
      erasure:
        data.POSTHOG_PERSONAL_API_KEY === undefined
          ? null
          : { personalApiKey: data.POSTHOG_PERSONAL_API_KEY, projectId: data.POSTHOG_PROJECT_ID!, host: data.POSTHOG_APP_HOST },
    },
    logs,
  };
};

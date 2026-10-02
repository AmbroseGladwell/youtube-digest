import { randomUUID } from "node:crypto";
import type { ClientError } from "@overview/domain";
import { sendPostHogBatch, type PostHogBatchOptions } from "../postHog/sendPostHogBatch.js";
import type { ErrorSink, ErrorSource, ServerError } from "./ErrorSink.js";

export interface PostHogErrorSinkOptions extends PostHogBatchOptions {
  environment: string;
  newDistinctId?: () => string;
}

// A stack reads newest call first; PostHog wants the call that threw last.
const oldestFirst = <Frame>(frames: Frame[]): Frame[] => [...frames].reverse();

const exceptionList = ({ type, message, handled, frames }: ClientError) => [
  {
    type,
    value: message,
    mechanism: { handled, synthetic: false },
    stacktrace: {
      type: "raw",
      frames: oldestFirst(frames).map((frame) => ({
        platform: "custom",
        lang: "javascript",
        function: frame.function,
        filename: frame.file,
        lineno: frame.line,
        colno: frame.column,
        in_app: true,
      })),
    },
  },
];

const serverExceptionList = ({ caughtBy, type, message, frames }: ServerError) => [
  {
    type,
    value: message,
    mechanism: { handled: false, synthetic: false, type: caughtBy },
    stacktrace: {
      type: "raw",
      frames: oldestFirst(frames).map((frame) => ({
        platform: "custom",
        lang: "javascript",
        function: frame.function,
        filename: frame.file,
        lineno: frame.line,
        colno: frame.column,
        in_app: frame.inApp,
      })),
    },
  },
];

// PostHog's error tracking, fed the same way as its events: an $exception per error.
// A reader with no account gets an id of its own per error and no person in PostHog
// (docs/architecture/errors-and-logs.md, "Who is reported").
export function createPostHogErrorSink({
  environment,
  newDistinctId = randomUUID,
  ...options
}: PostHogErrorSinkOptions): ErrorSink {
  return {
    capture: (errors, { accountId, context, geoAddress }: ErrorSource) =>
      sendPostHogBatch(
        errors.map((error) => ({
          event: "$exception",
          distinct_id: accountId ?? newDistinctId(),
          timestamp: error.at,
          properties: {
            $exception_list: exceptionList(error),
            error_source: error.source,
            ...(error.requestId === undefined ? {} : { request_id: error.requestId }),
            ...(error.apiErrorCode === undefined ? {} : { api_error_code: error.apiErrorCode }),
            ...(error.status === undefined ? {} : { status: error.status }),
            trail: error.trail,
            ...(accountId === null ? { $process_person_profile: false } : {}),
            surface: context.surface,
            layout: context.layout,
            app_version: context.appVersion,
            platform: context.platform,
            environment,
            ...(geoAddress === null ? {} : { $ip: geoAddress }),
          },
        })),
        options,
      ),
    captureServerError: (error: ServerError) => {
      const accountId = error.request?.accountId ?? null;
      return sendPostHogBatch(
        [
          {
            event: "$exception",
            distinct_id: accountId ?? newDistinctId(),
            timestamp: error.at,
            properties: {
              $exception_list: serverExceptionList(error),
              error_source: "server",
              ...(error.request === undefined
                ? {}
                : {
                    request_id: error.request.id,
                    method: error.request.method,
                    route: error.request.route,
                    status: error.request.status,
                  }),
              ...(accountId === null ? { $process_person_profile: false } : {}),
              surface: "api",
              environment,
              $geoip_disable: true,
            },
          },
        ],
        options,
      );
    },
  };
}

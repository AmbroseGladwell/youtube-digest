import path from "node:path";
import { MAX_ERROR_FRAMES, redactErrorMessage } from "@overview/domain";
import type { ServerError, ServerErrorFrame, ServerErrorRequest } from "./ErrorSink.js";

const V8_FRAME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;

const messageOf = (error: Error | null, thrown: unknown): string => {
  if (error !== null) {
    return error.message;
  }
  if (typeof thrown === "string") {
    return thrown;
  }
  return "";
};

const typeOf = (error: Error | null): string => {
  if (error === null) {
    return "NonError";
  }
  if (IDENTIFIER.test(error.name)) {
    return error.name;
  }
  return "Error";
};

export interface ToServerErrorOptions {
  caughtBy: ServerError["caughtBy"];
  request?: ServerErrorRequest;
  at: Date;
  root?: string;
}

const relativeFile = (location: string, root: string): string => {
  const file = location.startsWith("file://") ? new URL(location).pathname : location;
  return (path.isAbsolute(file) ? path.relative(root, file) : file).replace(/[^\w./@~+:-]/g, "_").slice(0, 200);
};

export const parseServerStack = (stack: string | undefined, root: string): ServerErrorFrame[] => {
  if (stack === undefined) {
    return [];
  }
  const frames: ServerErrorFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = V8_FRAME.exec(line);
    if (match === null) {
      continue;
    }
    const [, fn = "", location = "", lineNumber = "0", column = "0"] = match;
    const file = relativeFile(location, root);
    frames.push({
      function: fn
        .replace(/^async /, "")
        .replace(/[^\w$.<>[\] -]/g, "")
        .slice(0, 128),
      file,
      line: Number(lineNumber),
      column: Number(column),
      inApp: !file.startsWith("node:") && !file.includes("node_modules/"),
    });
    if (frames.length === MAX_ERROR_FRAMES) {
      break;
    }
  }
  return frames;
};

// What may leave the process: docs/architecture/errors-and-logs.md, "The server's own errors".
export const toServerError = (thrown: unknown, { caughtBy, request, at, root = process.cwd() }: ToServerErrorOptions): ServerError => {
  const error = thrown instanceof Error ? thrown : null;
  const message = messageOf(error, thrown);
  return {
    caughtBy,
    type: typeOf(error),
    message: redactErrorMessage(message),
    frames: parseServerStack(error?.stack, root),
    ...(request === undefined ? {} : { request }),
    at: at.toISOString(),
  };
};

import path from "node:path";
import { MAX_ERROR_FRAMES, redactErrorMessage } from "@overview/domain";
import type { ServerError, ServerErrorFrame, ServerErrorRequest } from "./ErrorSink.js";

const V8_FRAME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;

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

export function parseServerStack(stack: string | undefined, root: string): ServerErrorFrame[] {
  if (stack === undefined) return [];
  const frames: ServerErrorFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = V8_FRAME.exec(line);
    if (match === null) continue;
    const [, fn = "", location = "", lineNumber = "0", column = "0"] = match;
    const file = relativeFile(location, root);
    frames.push({
      function: fn.replace(/^async /, "").replace(/[^\w$.<>[\] -]/g, "").slice(0, 128),
      file,
      line: Number(lineNumber),
      column: Number(column),
      inApp: !file.startsWith("node:") && !file.includes("node_modules/"),
    });
    if (frames.length === MAX_ERROR_FRAMES) break;
  }
  return frames;
}

// Anything the server threw, as it may leave the process: the message redacted by the same
// rules a client's is, and paths made relative to where the server runs
// (docs/architecture/errors-and-logs.md, "The server's own errors").
export function toServerError(thrown: unknown, { caughtBy, request, at, root = process.cwd() }: ToServerErrorOptions): ServerError {
  const error = thrown instanceof Error ? thrown : null;
  const message = error !== null ? error.message : typeof thrown === "string" ? thrown : "";
  return {
    caughtBy,
    type: error !== null && IDENTIFIER.test(error.name) ? error.name : error !== null ? "Error" : "NonError",
    message: redactErrorMessage(message),
    frames: parseServerStack(error?.stack, root),
    ...(request === undefined ? {} : { request }),
    at: at.toISOString(),
  };
}

import { parentPort, threadId } from "node:worker_threads";

parentPort?.on("message", ({ id, html }: { id: number; html: string }) => {
  if (html === "hang") for (;;);
  if (html === "throw") throw new Error("scripted");
  parentPort?.postMessage({ id, read: { status: "failed", reason: "nothing-readable", siteName: `${html}@${threadId}` } });
});

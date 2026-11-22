import { request } from "node:http";
import { DEFAULT_NARRATION_VOICE, NARRATION_RENDER_VERSION, narrationLanguage, spokenScript, type Overview } from "@overview/domain";

export interface Narration {
  audio: Buffer;
  durationSeconds: number;
}

// node:http rather than fetch: a long note renders for more than fetch's five-minute header timeout on a laptop CPU.
const postJson = (url: URL, body: string): Promise<{ status: number; text: string }> =>
  new Promise((resolve, reject) => {
    const sent = request(url, { method: "POST", headers: { "content-type": "application/json" } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf-8") }));
      response.on("error", reject);
    });
    sent.on("error", reject);
    sent.end(body);
  });

export async function renderNarration(ttsUrl: string, overview: Overview): Promise<Narration> {
  const { status, text } = await postJson(
    new URL("/render", ttsUrl),
    JSON.stringify({
      lines: spokenScript(overview),
      voice: DEFAULT_NARRATION_VOICE,
      language: narrationLanguage(DEFAULT_NARRATION_VOICE),
      renderVersion: NARRATION_RENDER_VERSION,
    }),
  );
  if (status !== 200) {
    throw new Error(`TTS answered ${status}: ${text}`);
  }
  const rendered = JSON.parse(text) as { durationSeconds: number; audioBase64: string };
  return { audio: Buffer.from(rendered.audioBase64, "base64"), durationSeconds: rendered.durationSeconds };
}

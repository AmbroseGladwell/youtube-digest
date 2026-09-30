import { AwsClient } from "aws4fetch";
import type { AudioStore } from "./AudioStore.js";

export interface R2Settings {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// R2 through its S3 API, signed per request; the bucket is private and only this server
// holds a key to it (docs/features/tts-pre-rendered-speech.md, "The API side").
export function createR2AudioStore(
  { accountId, bucket, accessKeyId, secretAccessKey }: R2Settings,
  fetchImpl: typeof fetch = fetch,
): AudioStore {
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const objectUrl = (key: string) => `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}.m4a`;
  const send = async (url: string, init: RequestInit) => fetchImpl(await client.sign(url, init));

  return {
    async put(key, audio) {
      const response = await send(objectUrl(key), {
        method: "PUT",
        headers: { "content-type": "audio/mp4" },
        body: new Uint8Array(audio),
      });
      if (!response.ok) {
        throw new Error(`R2 refused to store ${key}: ${response.status}`);
      }
    },
    async get(key) {
      const response = await send(objectUrl(key), { method: "GET" });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`R2 refused to read ${key}: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },
    async delete(key) {
      const response = await send(objectUrl(key), { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 refused to delete ${key}: ${response.status}`);
      }
    },
  };
}

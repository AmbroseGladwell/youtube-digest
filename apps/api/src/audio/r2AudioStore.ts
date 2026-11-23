import { AwsClient } from "aws4fetch";
import { NARRATION_FILE_TYPE, NARRATION_SEGMENT_TYPE } from "@overview/domain";
import type { AudioStore } from "./AudioStore.js";

export interface R2Settings {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const createR2AudioStore = (
  { accountId, bucket, accessKeyId, secretAccessKey }: R2Settings,
  fetchImpl: typeof fetch = fetch,
): AudioStore => {
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const urlOf = (name: string) => `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${name}`;
  const fileName = (key: string) => `${key}.m4a`;
  const segmentName = (key: string, index: number) => `${key}/segments/${index}.aac`;
  const send = async (url: string, init: RequestInit) => fetchImpl(await client.sign(url, init));

  const put = async (name: string, contentType: string, audio: Buffer) => {
    const response = await send(urlOf(name), { method: "PUT", headers: { "content-type": contentType }, body: new Uint8Array(audio) });
    if (!response.ok) {
      throw new Error(`R2 refused to store ${name}: ${response.status}`);
    }
  };
  const get = async (name: string) => {
    const response = await send(urlOf(name), { method: "GET" });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`R2 refused to read ${name}: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  };
  const remove = async (name: string) => {
    const response = await send(urlOf(name), { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 refused to delete ${name}: ${response.status}`);
    }
  };

  return {
    put: (key, audio) => put(fileName(key), NARRATION_FILE_TYPE, audio),
    get: (key) => get(fileName(key)),
    delete: (key) => remove(fileName(key)),
    putSegment: (key, index, audio) => put(segmentName(key, index), NARRATION_SEGMENT_TYPE, audio),
    getSegment: (key, index) => get(segmentName(key, index)),
    async deleteSegments(key) {
      const listed = await send(`${urlOf("")}?list-type=2&prefix=${encodeURIComponent(`${key}/segments/`)}`, { method: "GET" });
      if (!listed.ok) {
        throw new Error(`R2 refused to list the segments of ${key}: ${listed.status}`);
      }
      for (const [, name] of (await listed.text()).matchAll(/<Key>([^<]+)<\/Key>/g)) {
        await remove(name!);
      }
    },
  };
};

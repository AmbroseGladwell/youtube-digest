import { AwsClient } from "aws4fetch";

export function r2SpendStore({ accountId, bucket, accessKeyId, secretAccessKey, fetch }) {
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const objectUrl = (key) => `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  const send = async (url, init) => fetch(await client.sign(url, init));
  return {
    async put(key, text) {
      const response = await send(objectUrl(key), { method: "PUT", headers: { "content-type": "text/csv" }, body: text });
      if (!response.ok) throw new Error(`R2 refused to store ${key}: ${response.status}`);
    },
    async get(key) {
      const response = await send(objectUrl(key), { method: "GET" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 refused to read ${key}: ${response.status}`);
      return response.text();
    },
  };
}

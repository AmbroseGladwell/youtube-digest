import { NarrationRender, NarrationVoice, VoiceSample, narrationKey } from "@overview/domain";
import { z } from "zod";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { NarrationApi } from "./NarrationApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

export type FetchNarrationApiOptions = ApiRequesterOptions;

const FoundRenders = z.object({ renders: z.array(NarrationRender) });

const ListedSamples = z.object({ samples: z.array(z.unknown()) });

const ignoringNotFound = (error: unknown) => {
  if (isSyncRequestError(error) && error.code === "not_found") return;
  throw error;
};

export function createFetchNarrationApi(options: FetchNarrationApiOptions): NarrationApi {
  const request = createApiRequester(options);
  const root = options.baseUrl.replace(/\/+$/, "");
  const status = (key: string) => answered(request("GET", `/audio/${key}`, NarrationRender));

  return {
    peek: async (lines, voice) => {
      const voiceByKey = new Map(
        await Promise.all(
          NarrationVoice.options.map(async (offered) => [await narrationKey(lines, offered), offered] as const),
        ),
      );
      const { renders } = await answered(
        request("POST", "/audio/lookup", FoundRenders, { body: { keys: [...voiceByKey.keys()] } }),
      );
      const found = renders.map((render) => ({ voice: voiceByKey.get(render.key)!, render }));
      return (
        found.find((narration) => narration.voice === voice) ??
        found.find((narration) => narration.render.status === "ready") ??
        null
      );
    },
    request: (lines, voice, priority) =>
      answered(request("POST", "/audio", NarrationRender, { body: { lines, voice, priority } })),
    status,
    discard: async (key) => {
      await request("DELETE", `/audio/${key}`, z.unknown()).catch(ignoringNotFound);
    },
    samples: async () =>
      (await answered(request("GET", "/audio/samples", ListedSamples))).samples.flatMap((listed) => {
        const sample = VoiceSample.safeParse(listed);
        return sample.success ? [sample.data] : [];
      }),
    fileUrl: ({ fileUrl }) => `${root}${fileUrl}`,
  };
}

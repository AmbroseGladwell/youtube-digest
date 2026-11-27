import type { AudioSetup } from "../buildApp.js";
import type { AudioConfig } from "../loadConfig.js";
import { createFileAudioStore } from "./fileAudioStore.js";
import { createHttpNarrator } from "./httpNarrator.js";
import { createR2AudioStore } from "./r2AudioStore.js";

export const createAudioSetup = (audio: NonNullable<AudioConfig>, runWorkers: boolean): AudioSetup => {
  return {
    narrator: createHttpNarrator(audio.ttsUrl),
    store: audio.store.kind === "r2" ? createR2AudioStore(audio.store) : createFileAudioStore(audio.store.dir),
    concurrency: audio.concurrency,
    liveSlots: audio.liveSlots,
    dollarsPerMachineHour: audio.dollarsPerMachineHour,
    modal:
      audio.modal === null
        ? null
        : {
            narrator: createHttpNarrator(audio.modal.url, fetch, { host: "modal", token: audio.modal.token }),
            dollarsPerHour: audio.modal.dollarsPerHour,
            monthlyDollars: audio.modal.monthlyDollars,
            liveSlots: audio.modal.liveSlots,
            renderSlots: audio.modal.renderSlots,
          },
    runWorkers,
  };
};

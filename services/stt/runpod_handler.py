import runpod

import gpu_worker


def handler(job: dict) -> dict:
    return gpu_worker.transcribe_url(job["input"]["engine"], job["input"]["audio_url"])


runpod.serverless.start({"handler": handler})

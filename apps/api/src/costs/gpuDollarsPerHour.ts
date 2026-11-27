// Modal's list prices, 15 Nov 2026; an unlisted card costs the dearest, so a cost is never under-recorded.
export const GPU_DOLLARS_PER_HOUR: Record<string, number> = {
  "Tesla T4": 0.59,
  "NVIDIA L4": 0.8,
  "NVIDIA A10": 1.1,
  "NVIDIA L40S": 1.95,
};

const DEAREST_GPU = Math.max(...Object.values(GPU_DOLLARS_PER_HOUR));

export const gpuDollarsPerHour = (gpu: string): number => GPU_DOLLARS_PER_HOUR[gpu] ?? DEAREST_GPU;

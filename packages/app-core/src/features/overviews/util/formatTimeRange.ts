import { formatTimestamp } from "@overview/domain";

export const formatTimeRange = (startMs: number, endMs: number): string => {
  return `${formatTimestamp(startMs)}–${formatTimestamp(endMs)}`;
};

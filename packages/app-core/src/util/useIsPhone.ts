import { useMediaQuery } from "./useMediaQuery.js";

export const PHONE_QUERY = "(max-width: 47.9375rem)";

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

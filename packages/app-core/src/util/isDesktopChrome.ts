export interface UserAgentDataLike {
  brands?: ReadonlyArray<{ brand: string }>;
  mobile?: boolean;
}

export const isDesktopChrome = (
  agent: { userAgentData?: UserAgentDataLike } | undefined = typeof navigator === "undefined"
    ? undefined
    : (navigator as { userAgentData?: UserAgentDataLike }),
): boolean => {
  const data = agent?.userAgentData;
  if (data === undefined || data.mobile !== false) return false;
  return (data.brands ?? []).some(({ brand }) => brand === "Google Chrome");
};

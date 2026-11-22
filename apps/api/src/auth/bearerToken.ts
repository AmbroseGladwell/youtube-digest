const BEARER = /^Bearer\s+(\S+)$/i;

export const bearerToken = (authorization: string | undefined): string | null => {
  if (authorization === undefined) {
    return null;
  }
  return BEARER.exec(authorization)?.[1] ?? null;
};

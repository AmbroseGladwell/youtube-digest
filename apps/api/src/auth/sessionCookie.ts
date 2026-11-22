export const SESSION_COOKIE = "overview_session";

export interface SessionCookieOptions {
  secure: boolean;
}

// The cookie's attributes and why: docs/features/sign-in.md, "Decisions, and why".
export const readSessionCookie = (cookieHeader: string | undefined): string | null => {
  if (cookieHeader === undefined) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.split("=");
    if (name?.trim() === SESSION_COOKIE) {
      const value = rest.join("=").trim();
      return value === "" ? null : decodeURIComponent(value);
    }
  }
  return null;
};

const attributes = ({ secure }: SessionCookieOptions): string =>
  ["Path=/", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ");

export interface CookieExpiry {
  expiresAt: string;
  now: Date;
}

export const sessionCookie = (token: string, { expiresAt, now, ...options }: SessionCookieOptions & CookieExpiry): string => {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; ${attributes(options)}`;
};

export const clearedSessionCookie = (options: SessionCookieOptions): string => {
  return `${SESSION_COOKIE}=; Max-Age=0; ${attributes(options)}`;
};

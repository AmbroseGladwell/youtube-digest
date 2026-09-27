export const SESSION_COOKIE = "overview_session";

export interface SessionCookieOptions {
  secure: boolean;
}

// The web app's transport: the token in an HttpOnly cookie on the API's own origin.
// SameSite=Lax keeps it off cross-site requests, and every write already needs a header
// no cross-site form can set (docs/features/sign-in.md).
export function readSessionCookie(cookieHeader: string | undefined): string | null {
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
}

const attributes = ({ secure }: SessionCookieOptions): string =>
  ["Path=/", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ");

export function sessionCookie(
  token: string,
  { expiresAt, now, ...options }: SessionCookieOptions & { expiresAt: string; now: Date },
): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; ${attributes(options)}`;
}

export function clearedSessionCookie(options: SessionCookieOptions): string {
  return `${SESSION_COOKIE}=; Max-Age=0; ${attributes(options)}`;
}

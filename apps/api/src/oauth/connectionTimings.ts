const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Why each is what it is: docs/features/mcp-connector.md, "Tokens".
export const AUTHORIZATION_TTL_MS = 30 * MINUTE_MS;
export const AUTHORIZATION_CODE_TTL_MS = MINUTE_MS;
export const ACCESS_TOKEN_TTL_MS = HOUR_MS;
export const REFRESH_TOKEN_TTL_MS = 30 * DAY_MS;
export const CONNECTION_TOUCH_INTERVAL_MS = HOUR_MS;

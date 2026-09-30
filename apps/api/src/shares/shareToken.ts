import { randomBytes } from "node:crypto";
import { SHARE_TOKEN_BYTES } from "@overview/domain";

export const shareToken = (): string => randomBytes(SHARE_TOKEN_BYTES).toString("base64url");

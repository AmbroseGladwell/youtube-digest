import { createHash } from "node:crypto";

export const hashedAddress = (address: string): string => createHash("sha256").update(address).digest("hex").slice(0, 32);

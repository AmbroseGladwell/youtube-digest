import { z } from "zod";

// docs/architecture/api.md, "Request ids".
export const REQUEST_ID_HEADER = "x-request-id";

export const RequestId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
export type RequestId = z.infer<typeof RequestId>;

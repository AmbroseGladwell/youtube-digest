import { z } from "zod";

// The id one API call is logged under on both sides: the client makes it, the server reuses
// it rather than minting its own, and says it back (docs/architecture/api.md, "Request ids").
export const REQUEST_ID_HEADER = "x-request-id";

export const RequestId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
export type RequestId = z.infer<typeof RequestId>;

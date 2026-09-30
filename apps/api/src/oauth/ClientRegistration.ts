import { z } from "zod";

export const TokenEndpointAuthMethod = z.enum(["none", "client_secret_post", "client_secret_basic"]);
export type TokenEndpointAuthMethod = z.infer<typeof TokenEndpointAuthMethod>;

const GRANT_TYPES = ["authorization_code", "refresh_token"];

// RFC 7591's metadata, the part of it this server acts on. Anything else a client sends is
// ignored rather than refused, as the RFC asks.
export const ClientRegistration = z.looseObject({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z
    .string()
    .trim()
    .transform((name) => name.slice(0, 100))
    .optional()
    .transform((name) => (name === "" ? undefined : name)),
  token_endpoint_auth_method: TokenEndpointAuthMethod.default("client_secret_basic"),
  grant_types: z
    .array(z.string())
    .default(["authorization_code"])
    .refine((types) => types.every((type) => GRANT_TYPES.includes(type)), "only authorization_code and refresh_token"),
  response_types: z
    .array(z.string())
    .default(["code"])
    .refine((types) => types.every((type) => type === "code"), "only code"),
});
export type ClientRegistration = z.infer<typeof ClientRegistration>;

const REFUSAL = JSON.stringify({
  type: "error",
  error: {
    type: "invalid_request_error",
    message:
      "The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.",
  },
});

// Refused as Claude did on OV-246, so a run measures what the schema-in-prompt fallback writes.
const urlOf = (input: string | URL | Request): string => {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
};

export const refuseEnforcedSchema =
  (http: typeof fetch): typeof fetch =>
  async (input, init) => {
    const enforced = typeof init?.body === "string" && init.body.includes('"output_config"');
    return enforced && urlOf(input).startsWith("https://api.anthropic.com/")
      ? new Response(REFUSAL, { status: 400, headers: { "content-type": "application/json" } })
      : http(input, init);
  };

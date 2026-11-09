const REFUSAL = JSON.stringify({
  type: "error",
  error: {
    type: "invalid_request_error",
    message: "The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.",
  },
});

// Answers Claude's enforced-schema request the way Claude did on OV-246, without sending it,
// so a comparison measures the overviews the schema-in-prompt fallback writes.
export const refuseEnforcedSchema =
  (http: typeof fetch): typeof fetch =>
  async (input, init) => {
    const enforced = typeof init?.body === "string" && init.body.includes('"output_config"');
    return enforced && String(input).startsWith("https://api.anthropic.com/")
      ? new Response(REFUSAL, { status: 400, headers: { "content-type": "application/json" } })
      : http(input, init);
  };

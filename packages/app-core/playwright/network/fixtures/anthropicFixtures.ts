// GeneratedOutput's shape, untyped so this fixture doesn't depend on generation's internals.
export const makeGeneratedOutputFixture = (overrides: Record<string, unknown> = {}) => {
  return {
    inOneLine: "A simulated creator explains one claim and one technique.",
    bigPicture: "",
    followUpQuestions: [],
    readerQuestions: [],
    coreClaim: "The simulated technique works because the fixture says so.",
    thin: false,
    keyPoints: [
      { text: "The video opens with a greeting.", startSegmentIndex: -1, endSegmentIndex: -1 },
      { text: "It states one claim.", startSegmentIndex: -1, endSegmentIndex: -1 },
      { text: "It closes with how to apply that claim.", startSegmentIndex: -1, endSegmentIndex: -1 },
    ],
    chapters: [
      { title: "The greeting", summary: "The simulated creator says hello.", startSegmentIndex: 0 },
      { title: "The claim and how to apply it", summary: "One claim, then its use.", startSegmentIndex: 1 },
    ],
    matchedTopicNames: [],
    suggestedTopic: null,
    tags: ["iwft-fixture", "simulated-video", "test-data"],
    verdict: {
      novelty: "original",
      standsOut: { text: "A new idea.", startSegmentIndex: 1, endSegmentIndex: 1 },
      dubiousClaims: [],
      reasoning: "This is fixture reasoning text, not a real judgment.",
      similarToIndices: [],
    },
    selling: { type: "none", detail: "Nothing is being sold in this fixture.", compromisesContent: false },
    howToApply: { items: ["Apply the simulated technique once."] },
    watchAnyway: {
      answer: "partial",
      reason: "Only the fixture's second segment is worth watching directly.",
      startSegmentIndex: 0,
      endSegmentIndex: 1,
    },
    ...overrides,
  };
};

// Anthropic's shape, shared by OpenAI, DeepSeek, xAI and Mistral; Gemini's has its own scenario.
export const makeModelListResponse = (ids: string[] = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]) => {
  return { data: ids.map((id) => ({ id, type: "model", display_name: id })) };
};

export const makeAnthropicMessageResponse = (generatedOutput: Record<string, unknown>) => {
  return {
    id: "msg_iwft_fixture",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [{ type: "text", text: JSON.stringify(generatedOutput) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 100 },
  };
};

// A short clip's prompt allows no chapters and no part worth watching, and the simulated model obeys it as a real one must.
export const fittedToTheAsk = (output: Record<string, unknown>, ask: string): Record<string, unknown> => {
  const fitted = { ...output };
  if (ask.includes("too short to split into chapters")) {
    fitted.chapters = [];
  }
  if (ask.includes("never answer partial") && typeof fitted.watchAnyway === "object" && fitted.watchAnyway !== null) {
    fitted.watchAnyway = { ...fitted.watchAnyway, answer: "no", startSegmentIndex: -1, endSegmentIndex: -1 };
  }
  return fitted;
};

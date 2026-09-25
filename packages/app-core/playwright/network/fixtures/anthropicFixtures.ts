// The shape generateOverview() expects back from the model — GeneratedOutput from
// @overview/generation, matching every optional section since DEFAULT_SECTIONS_ENABLED
// turns them all on. Not imported as a type here to keep this file dependency-free of
// generation's internals; it's a plain fixture object the network layer serializes.
export function makeGeneratedOutputFixture(overrides: Record<string, unknown> = {}) {
  return {
    inOneLine: "A simulated creator explains one claim and one technique.",
    coreClaim: "The simulated technique works because the fixture says so.",
    thin: false,
    keyPoints: [
      "The video opens with a greeting.",
      "It states one claim.",
      "It closes with how to apply that claim.",
    ],
    chapters: [
      { title: "The greeting", summary: "The simulated creator says hello.", startSegmentIndex: 0 },
      { title: "The claim and how to apply it", summary: "One claim, then its use.", startSegmentIndex: 1 },
    ],
    matchedTopicNames: [],
    suggestedTopic: null,
    tags: ["iwft-fixture", "simulated-video", "test-data"],
    verdict: {
      novelty: "novel",
      dubious: false,
      reasoning: "This is fixture reasoning text, not a real judgment.",
      similarToIndices: [],
    },
    selling: { type: "none", detail: "Nothing is being sold in this fixture.", compromisesContent: false },
    howToApply: { items: ["Apply the simulated technique once."] },
    watchAnyway: {
      answer: "partial",
      reason: "Only the fixture's second segment is worth watching directly.",
      range: { startSegmentIndex: 0, endSegmentIndex: 1 },
    },
    ...overrides,
  };
}

export function makeAnthropicMessageResponse(generatedOutput: Record<string, unknown>) {
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
}

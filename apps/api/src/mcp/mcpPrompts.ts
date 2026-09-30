export interface McpPromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface McpPrompt {
  name: string;
  title: string;
  description: string;
  arguments: McpPromptArgument[];
  text(args: Record<string, string>): string;
}

// So that reading many overviews at once is something a reader can find in a client that
// lists prompts, rather than something they have to know to ask for.
export const mcpPrompts: readonly McpPrompt[] = [
  {
    name: "compare_topic",
    title: "Compare what I've saved on a topic",
    description: "Where the videos saved under one topic agree, where they contradict each other, and what only one of them claims",
    arguments: [{ name: "topic", description: "The topic's name", required: true }],
    text: ({ topic }) =>
      [
        `Read everything I've saved on "${topic}" with the get_overviews tool (topic: "${topic}"), following its cursor until you have every overview.`,
        "Then tell me where the videos agree, where they contradict each other, and what only one of them claims.",
        "Cite every point with the video's title and a link to its moment in the video from the chapters, and say where the verdict judged a video dubious.",
      ].join(" "),
  },
];

import { TopicId, type Topic } from "@overview/domain";

export const makeTopic = (overrides: Partial<Topic> = {}): Topic => ({
  id: TopicId.parse(crypto.randomUUID()),
  name: "energy",
  description: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

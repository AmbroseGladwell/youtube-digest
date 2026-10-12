import { Provider } from "@overview/domain";

export interface ComparedModel {
  provider: Provider;
  model: string;
}

export const comparedModelName = ({ provider, model }: ComparedModel): string => `${provider}:${model}`;

export function parseComparedModel(name: string): ComparedModel {
  const separator = name.indexOf(":");
  if (separator <= 0 || separator === name.length - 1) {
    throw new Error(`"${name}" is not provider:model, such as anthropic:claude-opus-5-5`);
  }
  return { provider: Provider.parse(name.slice(0, separator)), model: name.slice(separator + 1) };
}

export const previewChoiceLineTestIds = {
  line: (name: string) => `PreviewChoiceLine.line.${name}`,
  name: (name: string) => `PreviewChoiceLine.name.${name}`,
  result: (name: string) => `PreviewChoiceLine.result.${name}`,
  changeButton: (name: string) => `PreviewChoiceLine.changeButton.${name}`,
  choice: (name: string) => `PreviewChoiceLine.choice.${name}`,
  option: (name: string, option: string) => `PreviewChoiceLine.option.${name}.${option}`,
};

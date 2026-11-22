import { ChatReply, type ChatReplySection } from "./ChatReply.js";
import { sectionsSoFar } from "./sectionsSoFar.js";

export interface ArrivedSections {
  sections: ChatReplySection[];
  seen: number;
}

export const arrivedSections = (partialJson: string, alreadySeen: number): ArrivedSections => {
  const whole = sectionsSoFar(partialJson);
  const sections = whole.slice(alreadySeen).flatMap((each) => {
    const section = ChatReply.shape.sections.element.safeParse(each);
    return section.success ? [section.data] : [];
  });
  return { sections, seen: whole.length };
};

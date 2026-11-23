import type { ChatSourceKind, OverviewId } from "@overview/domain";

export interface AskQuestionOverview {
  id: OverviewId;
  title: string;
  kind: ChatSourceKind;
  imageUrl: string | null;
  wide: boolean;
}

export interface CustomAskQuestion {
  kind: "custom";
  id: string;
  text: string;
  overviews: readonly [AskQuestionOverview, AskQuestionOverview];
  good: boolean;
}

export interface TemplateAskQuestion {
  kind: "template";
  id: string;
  text: string;
}

export type AskQuestion = CustomAskQuestion | TemplateAskQuestion;

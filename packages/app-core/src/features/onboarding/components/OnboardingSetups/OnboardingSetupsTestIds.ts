import type { ThemeMode, AccentColour, FollowUpAssistant } from "@overview/domain";

export const onboardingSetupsTestIds = {
  root: "onboarding-setups",
  heading: "onboarding-setups-heading",
  card: (setup: string) => `onboarding-setups-card-${setup}`,
  count: "onboarding-setups-count",
  previous: "onboarding-setups-previous",
  next: "onboarding-setups-next",
  theme: (theme: ThemeMode) => `onboarding-setups-theme-${theme}`,
  accent: (accentColour: AccentColour) => `onboarding-setups-accent-${accentColour}`,
  addToChrome: "onboarding-setups-add-to-chrome",
  connect: (assistant: FollowUpAssistant) => `onboarding-setups-connect-${assistant}`,
  status: "onboarding-setups-status",
};

import type { Plan } from "@overview/domain";

export const plansModalTestIds = {
  root: "plans-modal",
  close: "plans-modal-close",
  card: (plan: Plan) => `plans-modal-card-${plan}`,
  choose: (plan: Plan) => `plans-modal-choose-${plan}`,
};

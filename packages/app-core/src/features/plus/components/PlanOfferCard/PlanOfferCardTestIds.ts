import type { Plan } from "@overview/domain";

export const planOfferCardTestIds = {
  card: (plan: Plan) => `plan-offer-${plan}`,
  tellMeWhen: (plan: Plan) => `plan-offer-${plan}-tell-me-when`,
};

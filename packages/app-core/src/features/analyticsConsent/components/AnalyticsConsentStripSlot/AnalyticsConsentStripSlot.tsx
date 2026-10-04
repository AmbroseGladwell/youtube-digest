import type { AnalyticsConsentStrip } from "../../useAnalyticsConsentStrip.js";
import { AnalyticsConsentNotice } from "../AnalyticsConsentNotice/AnalyticsConsentNotice.js";
import { AnalyticsConsentPrompt } from "../AnalyticsConsentPrompt/AnalyticsConsentPrompt.js";

export function AnalyticsConsentStripSlot({ strip, panel = false }: { strip: AnalyticsConsentStrip; panel?: boolean }) {
  return strip.kind === "prompt" ? (
    <AnalyticsConsentPrompt ask={strip.ask} panel={panel} />
  ) : (
    <AnalyticsConsentNotice answer={strip.answer} panel={panel} />
  );
}

# Analytics consent

A reader without an account is asked, once, whether to share how they use the app, and
nothing is sent for them until they say yes. Design: "OV-62 1 Prompt" (62a–62c). Card:
OV-62. The privacy policy it links to is OV-79.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The consent record: the answer, when, to which list of what is counted, and the anonymous id | `features/analyticsConsent/types/AnalyticsConsent.ts`, `analyticsConsentStorage.ts` |
| One shared snapshot the prompt writes and the queue reads at once | `features/analyticsConsent/useAnalyticsConsent.ts` |
| The list of what is counted, and when it asks again | `features/analyticsConsent/analyticsPurposes.ts`, `util/consentAskOf.ts` |
| Which strip the slot holds | `features/analyticsConsent/useAnalyticsConsentStrip.ts`; `shell/AppShell/AppShell.tsx` and `features/capture/CapturePage/CapturePage.tsx` for the order |
| The prompt (62a, 62b) and the notice after it (62c) | `features/analyticsConsent/components/` |
| Sending under the anonymous id, and only after a yes | `features/analytics/AnalyticsRuntime.tsx` |
| The batch's `anonymousId`, and `analyticsConsent.prompt.accepted` | `packages/domain/src/AnalyticsEventBatch.ts`, `analyticsEvents.ts` |
| The route taking an anonymous batch, and its limit per address | `apps/api/src/events/eventRoutes.ts`, `rateLimit/rateLimits.ts` (`anonymousEventsAddress`) |
| PostHog: the anonymous id as the distinct id, no person made | `apps/api/src/events/postHogEventSink.ts` |
| The screens | `packages/app-core/playwright/iwft/scenarios/analyticsConsent.iwft.ts` |

## Three tiers

1. **No account, no yes:** nothing is sent and nothing about analytics is stored. Errors
   are still reported, with no id (`docs/architecture/errors-and-logs.md`). Errors are not
   part of the choice, so the prompt doesn't mention them.
2. **No account, a yes:** a random id (`crypto.randomUUID()`, never derived from the device)
   is kept beside the answer and sent on every batch as `anonymousId`. The server takes the
   batch without a session.
3. **Signed in:** the account id from the session, under legitimate interests. A signed-in
   reader is never asked.

## The record

`overview.analyticsConsent.v1` in `localStorage`, in both shells: the answer (`share` or
`dontShare`), when it was given, the purposes version it answered, and the anonymous id,
which is null unless the answer is yes. It is kept for the browser or install, whoever
signs in, like the device's account history (`account-libraries.md`). Storing a no needs
no consent; the id is written only after a yes.

**The id belongs to whoever uses the device without an account.** When a session starts,
`AnalyticsRuntime` drops the id; when there is no session and the answer is yes, it makes a
new one. So the next person to use a shared device without an account is never counted
under the last one's id, and the answer survives sign-out while the id does not.

A record the app can't read is treated as no answer: the reader is asked again rather than
counted.

## Asking again

`ANALYTICS_PURPOSES` lists every change to what is counted. Adding one asks every reader
again, whatever they answered, with 62b's "We've updated what we collect" and the change's
own words ("Now including …"). Until they answer, a yes to the old list sends nothing: a
yes counts only for the list it answered (`consentAllowsSharing`).

## Where it shows

The library's strip slot on the web, and above the panel's home in the extension. Never
signed in, and never anywhere else: not on an overview, Settings, sign-in, the shared page,
`/privacy` or `/terms`. On the web it shows on the empty first-run page too, since that is
the library at `/`. A shell with no server to send to asks nothing.

**One strip at a time, highest first:** the generation strip; the move notice (47e), which
is signed in only and so never meets the prompt; the prompt, then its notice; the
signed-out strip (47a) or the account offer (47c). The prompt outranks 47a and 47c because
it holds back data until answered. 47c doesn't count as dismissed while it waits.

**The prompt is a region, not a dialog.** It has no ×: ignoring it collects nothing, and
"Don't share" is how it goes away. The two answers are the same pill, size and weight, and
neither is orange. What is collected is said in the prompt itself, with the privacy policy
linked inline: the Chrome Web Store asks for disclosure inside the product, not only in a
policy. In the extension the link opens the web app's `/privacy` in a tab of its own.

**After either answer (62c)** a notice says what was chosen and where to change it, and
goes after ten seconds or with ×. The two answers get the same notice.

## Analytics and logging

`analyticsConsent.prompt.accepted({ asked: "first" | "again" })` is the first event a
reader without an account sends, recorded straight after the yes is stored, so the queue
sees it. A no sends nothing. Every event a signed-out reader's app already calls
(`account.signIn.*`, the strips') is sent once they say yes.

The server logs each event with `signedIn`, and never the anonymous id in the log line.

## Not built yet

- **Settings › Privacy** (part 2 of the design): the section, its switch and withdrawal.
  The `privacy` section id is reserved, and the notice already links to it, but the section
  isn't listed yet, so the link opens Settings.
- **The create-account line** (part 3).
- **Linking the anonymous id at sign-up**, for readers who said yes, and the account's own
  opt-out for a signed-in reader, enforced on the server.
- **Deleting anonymous data never linked after 30 days.** PostHog keeps events for a year.
- **The privacy policy page** is OV-79. Until it exists, the prompt's link has nowhere to go.
- **A no is not logged.** The card asks for declines to be counted as a log line with no
  id; nothing sends one yet.

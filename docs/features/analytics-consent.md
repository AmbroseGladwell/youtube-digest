# Analytics consent

A reader without an account is asked, once, in onboarding, whether to allow analytics, and
nothing is sent for them until they say yes. Every reader can change it in Settings ›
Privacy, and a signed-in reader's choice is kept on their account. Creating an account says
what it agrees to, and links what a reader shared before to the account. Readers see the
word "analytics", never "share usage" (OV-101). Designs: "OV-62 2 Privacy" (62d–62i), "OV-62
3 Create Account" (62j) and onboarding's analytics screen (46b). Cards: OV-62, OV-80, OV-46
and OV-101. The privacy policy it links to is OV-79.

**The library's strip is gone (OV-101).** OV-62's prompt in the strip slot (62a, 62b) and
the notice after it (62c) were removed once OV-46's onboarding asked on its own screen: signed
out sees no library, so a reader without an account meets the question in onboarding first.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The consent record: the answer, when, to which list of what is counted, and the anonymous id | `features/analyticsConsent/types/AnalyticsConsent.ts`, `analyticsConsentStorage.ts` |
| One shared snapshot an answer writes and the queue reads at once | `features/analyticsConsent/useAnalyticsConsent.ts` |
| The list of what is counted, and whether an answer is to an older one | `features/analyticsConsent/analyticsPurposes.ts`, `util/consentAllowsSharing.ts` |
| The question, in onboarding (46b) | `features/onboarding/components/OnboardingAnalytics/`, answered in `features/onboarding/OnboardingPage/OnboardingPage.tsx` |
| Sending under the anonymous id, and only after a yes; holding events until an answer | `features/analytics/AnalyticsRuntime.tsx`, `AnalyticsQueue.ts` |
| The batch's `anonymousId`, and `analyticsConsent.prompt.accepted` | `packages/domain/src/AnalyticsEventBatch.ts`, `analyticsEvents.ts` |
| The route taking an anonymous batch, and its limit per address | `apps/api/src/events/eventRoutes.ts`, `rateLimit/rateLimits.ts` (`anonymousEventsAddress`) |
| PostHog: the anonymous id as the distinct id, no person made | `apps/api/src/events/postHogEventSink.ts` |
| Settings › Privacy: the switch, what its line says, and what turning it writes (62d–62h) | `features/analyticsConsent/components/PrivacySection/`, `useShareUsage.ts`, `util/shareUsageStatus.ts` |
| The policy and terms links, in Privacy and About (62i) | `features/settings/components/PolicyLinks/`, `analyticsConsent/util/policyPageUrl.ts` |
| A signed-in reader's opt-out, on the account | `packages/domain/src/Settings.ts` (`analyticsOptOut`, `analyticsOptOutChangedAt`); `apps/api/src/events/eventRoutes.ts` drops the account's events |
| A no, counted with no id | `features/analyticsConsent/useAnalyticsDecline.ts`; `POST /api/events/declined` in `eventRoutes.ts` |
| The line on the create-account page (62j) | `features/auth/components/AccountTermsLine/`, placed by `EmailLinkForm`'s `aboveSubmit` |
| The anonymous id sent with a request to create an account, and linked once the account is made | `features/auth/components/RequestLinkFlow/RequestLinkFlow.tsx`; `packages/domain/src/MagicLinkRequest.ts`; `apps/api/migrations/V0011__magic_link_anonymous_ids.sql`, `src/auth/authRoutes.ts`; `EventSink.link` in `src/events/` |
| The screens | `packages/app-core/playwright/iwft/scenarios/analyticsConsent.iwft.ts`, `onboarding.iwft.ts`, `settingsPrivacy.iwft.ts`, `accountTerms.iwft.ts` |

## Three tiers

1. **No account, no yes:** nothing is sent and nothing about analytics is stored. Errors
   are still reported, with no id (`docs/architecture/errors-and-logs.md`). Errors are not
   part of the choice, so the question doesn't mention them. Before any answer, events wait
   in memory (below); after a no, they are never collected.
2. **No account, a yes:** a random id (`crypto.randomUUID()`, never derived from the device)
   is kept beside the answer and sent on every batch as `anonymousId`. The server takes the
   batch without a session.
3. **Signed in:** the account id from the session, under legitimate interests. A signed-in
   reader is never asked, and can turn it off in Settings › Privacy.

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

A record the app can't read is treated as no answer: nothing is sent, and onboarding asks
again rather than counting the reader.

## Before an answer

**A reader who hasn't answered yet has their events held in memory, not thrown away**
(OV-46, decided 28 Oct 2026). Onboarding asks on its second screen, after the reader has
pasted a link, and the funnel needs that first screen counted. So `AnalyticsQueue` has
three modes, which `AnalyticsRuntime` picks on every record and flush:

- **send:** signed in with the account's analytics on, or no account and a yes.
- **hold:** no account, no answer to the current list of what is counted (`consentAnswered`),
  and a server to send to. Events stay in the
  queue's memory, are never written to the device, and aren't sent on a timer or when the
  page hides. Closing the page loses them.
- **discard:** anything else, including a no to the current list.
  Events aren't collected, and whatever was held is forgotten.

The runtime flushes when the answer or the session changes. A yes sends what was held
first, in order, then `analyticsConsent.prompt.accepted`. A no forgets it. A reader who
signs in before answering has what was held sent under their account, as tier 3 would
have counted it.

The cap on what the queue holds is the same one batch it always had, so a reader who never
answers holds at most one batch of events, in memory, until they leave.

## When what is counted changes

`ANALYTICS_PURPOSES` lists every change to what is counted. A yes counts only for the list
it answered (`consentAllowsSharing`), so adding one stops sending for a reader without an
account until they say yes again. There is no strip to ask them, so the answer is put to
them again in two places (`consentOutdated`):

- **Onboarding** shows its analytics screen to a device whose answer is to an older list,
  as it does to one that never answered. Until it is answered, events are held, as before
  an answer, and sent on Allow.
- **Settings › Privacy** shows an older yes as off, since nothing is sent, with "Analytics
  now covers more …" under it. Turning it on says yes to the current list.

A signed-in reader is never asked. The privacy policy says what was added.

## Where it's asked

Only on onboarding's analytics screen, the second (design 46b), on the web and in the
extension panel, so a reader starting their first overview answers before anything is sent.
Never signed in, and never anywhere else: not on the library, the panel's home, an overview,
Settings, sign-in, the shared page, `/privacy` or `/terms`. A shell with no server to send to
asks nothing.

**The rules kept from OV-62.** The two answers, **Allow** and **No thanks**, are the same
size and weight, nothing is preselected, and neither is orange. What is counted is said on
the screen, "which features are used, never what you read or watch", with the privacy policy
linked beside it: the Chrome Web Store asks for disclosure inside the product, not only in a
policy. In the extension the link opens the web app's `/privacy` in a tab of its own.

No thanks is the skip. What happened since Start is held in memory, as above, and sent on
Allow, whose `analyticsConsent.prompt.accepted` says `asked: "onboarding"`. A device that
has answered the current list passes the screen by. Neither answer shows a notice: the next screen
follows straight on.

## Settings › Privacy

The seventh row, between Plan and About, shown whenever there is a server to send to. Its
value is "Not chosen", "On" or "Off". One switch, "Analytics" (`role="switch"`), the same for
everyone; its line under the label is its description and says what it means:

| Who | Off | On |
|---|---|---|
| No account, never answered | "You haven't chosen yet, so nothing is counted." | — |
| No account, answered | "Off since 4 October 2026" | "On since 4 October 2026" |
| No account, answered an older list | "Analytics now covers more, so nothing is counted until you turn it on again.", whatever the answer was | — |
| Signed in | "Off across your devices since 4 October 2026" | "On across your devices", with "since …" once changed |

A date that is today reads "today". The text under the switch says what is counted, and
signed out that the random id lives in this browser (or the extension) and is deleted when
the switch goes off. Error reports sit in a card of their own, with no switch. The privacy
policy and the terms are linked at the foot, and under the version in About.

**Signed out, the switch is onboarding's answer.** On records a yes and makes a new
anonymous id; one deleted by a no is never used again. Off records a no and deletes the id.
Answering here means onboarding passes its analytics screen by.

**Signed in, it is the account's opt-out:** `Settings.analyticsOptOut` and the time it
changed, which sync like any setting. While it is on, the app sends nothing and
`/api/events` drops whatever an account's devices still send, logging only how many
(`client events dropped for opt-out`). A record from before the switch reads as sharing.

**Off sends its own event first.** `analyticsConsent.settings.switched({ on: false })` is
recorded and the queue flushed before the answer changes, so what was recorded under the
yes goes out under it and nothing follows. On is recorded after the answer is stored, and
for an account once the setting is saved.

## Creating an account

**The line (62j).** Directly above Create account, in the page's small print: "By creating
an account, you agree to the Terms and Privacy policy, including analytics on which features
you use. You can turn this off in Settings › Privacy." Terms and Privacy policy link to `/terms`
and `/privacy`, in a new tab from the extension; "Settings › Privacy" is plain text. There
is no checkbox: counting a signed-in reader rests on legitimate interests, not consent, so
it isn't dressed as a choice, and the switch still turns it off. In the extension it is
also the Chrome Web Store's in-product disclosure. Flush left on a wide screen; on a phone
and in the panel it is centred with a full-width button and the way to sign in, at the
form's foot.

**Linking.** A reader who said yes on this device sends their anonymous id with the request
to create an account (`intent: "createAccount"`); anyone else sends none, and a request to
sign in never carries one. The server keeps it on the magic link and, only if opening the
link creates the account, sends PostHog one `$identify` under the account naming the
anonymous id, so what they shared before is read as theirs. It logs `anonymous id linked`
under the account, never the id. An account that already existed is never linked, and
PostHog being down never fails the sign-in.

## Analytics and logging

`analyticsConsent.prompt.accepted({ asked: "onboarding" })` is the first event a reader
without an account sends, recorded straight after the yes is stored, so the queue sees it.
`"first"` and `"again"` stay in the schema for what the library's strip sent before OV-101;
nothing records them now. Every event a signed-out reader's app already calls
(`account.signIn.*`, onboarding's) is sent once they say yes. `analyticsConsent.settings.switched({ on })` is the
switch in Settings.

**A no is counted with no id.** No thanks in onboarding, from a reader who hadn't said yes,
posts the app's context alone to `POST /api/events/declined`, which logs `analytics
declined` and keeps nothing else; it is limited per address like anonymous events.
`useAnalyticsDecline` records the no and posts it only when it is a decline. A no after a yes is a withdrawal, not a decline, and isn't posted. The switch can't
decline: from "Not chosen" it can only turn on.

The server logs each event with `signedIn`, and never the anonymous id in the log line.
Changing the account's opt-out logs `analytics opt-out set`.

## Not built yet

- **Deleting anonymous data never linked after 30 days.** PostHog keeps events for a year.
- **The privacy policy and terms pages** are OV-79. Until they exist, the links have nowhere
  to go.

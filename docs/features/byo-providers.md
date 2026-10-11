# Bring your own key, from any of six providers

Design: "OV-110 1 Keys", "OV-110 2 Adding and Choosing", "OV-110 3 When It Goes Wrong",
"OV-110 4 Outside Settings" (110a–110m). Card: OV-110.

Generation was Anthropic-only, behind a provider interface that
`docs/architecture/v1-architecture-decisions.md` put there on purpose: *"Multi-provider BYO
is real future work, but [structured output] needs building once, correctly, before it's
multiplied across providers with different structured-output mechanisms."* It has been
built once and is now multiplied across six.

The six are **Anthropic, OpenAI, Google Gemini, DeepSeek, xAI Grok and Mistral**. A reader
holds a key for as many as they like, all on the device they were added on; one provider
and model is what generation runs on, and that choice syncs.

## What was checked before any of it was designed

Each of these was tested against the providers' live APIs on 11 October 2026, not assumed.
They are the reason several screens exist.

- **Every one of the six answers a cross-origin preflight**, on both its generation
  endpoint and its model-list endpoint. So the browser-held key of
  `docs/architecture/v1-architecture-decisions.md`'s Model D survives intact: no server of
  ours is ever in the path, for any provider. Anthropic needs
  `anthropic-dangerous-direct-browser-access` and Gemini needs the key in `x-goog-api-key`;
  both are sent by the adapter.
- **Five of the six enforce a JSON schema. DeepSeek does not** — its API offers JSON mode
  and nothing else. That is handled below rather than by excluding it.
- **Model ids drift faster than releases do.** The four Claude models this app offered were
  already a release behind on the day the work started. That is why the list is fetched
  with the reader's own key and the curated one is only a floor.

## The shape of it

| The decision | Where it lives |
|---|---|
| The six, their labels, consoles and origins | `packages/domain`: `Provider.ts` |
| The models we describe, their rough prices, and the fallback list | `packages/domain`: `KnownModel.ts` |
| The model each provider remembers | `packages/domain`: `ModelByProvider.ts`, on `Settings` |
| One adapter per provider, behind one interface | `packages/generation/src/providers/`, picked by `adapterFor` |
| Zod to the one JSON Schema all five schema-takers accept | `packages/generation`: `providerJsonSchema.ts` |
| Asking a provider what the key can reach | `packages/generation`: `listProviderModels.ts` |
| A key per provider, device-local | `packages/app-core`: `features/apiKeys/ApiKeys.ts` |
| What each key last reported it could reach | `features/apiKeys/ModelCatalogue.ts` |
| Chrome's per-provider permission | `features/apiKeys/ProviderPermissionContext.ts`, `apps/extension/src/chromeProviderPermissions.ts` |

## Four adapters, not six

OpenAI, DeepSeek, xAI and Mistral all speak OpenAI's chat-completions dialect, so they
share one adapter that differs in a base URL and in whether the provider will take a
schema. Anthropic and Gemini have their own. Adding a seventh OpenAI-compatible provider is
a row in `adapterFor` and an origin in `Provider.ts`.

## The schema is the same object for all five, and words for the sixth

`providerJsonSchema` turns the composed Zod schema into the one JSON Schema every
schema-taking provider accepts: every object closed, every property required, no validation
keyword beyond `type`, `enum` and `description`.

**The keywords it strips are not dropped, they are said in the description.** This is not
new behaviour — `docs/features/overview-generation-decisions.md` records that the array cap
already reached the model as a description string and that the real enforcement is
`generateOverview` parsing the answer and asking once more. Keeping that identical across
six providers matters, because the overview format was tuned against a model that could
read its own caps in words.

**DeepSeek is given the same schema object inside the prompt**, with JSON mode on. It leans
on the correction pass harder than the others will, and that is the known cost of including
it. It is not marked as lesser anywhere in the UI: the design decided that a real trade-off
is not a fault, and a reader who has chosen DeepSeek has chosen its economics.

## Which models are offered

Asked with the reader's own key the moment it is saved, and again when the picker opens if
the answer is more than a day old. The same call is the only honest check that the key
works, which is why saving is two beats and the second one can fail.

**What cannot write an overview is counted, not listed.** Gemini and Mistral say outright
what each model can do and are believed. The rest are read by name, and that test is
deliberately one-sided: a model wrongly dropped is one the reader cannot pick at all, while
a model wrongly kept is one they pick and see fail once, with the raw id in front of them.
So anything unrecognised is offered.

**When the catalogue call fails the picker shows the models we know and says so in one
muted line.** Not an error: the key works, only the list is missing. The "everything else"
group is dropped rather than shown empty.

## The one genuinely new failure

A key is device-local. The provider and model are a preference and sync. So a reader can
choose Gemini on a laptop and open the app on a phone that holds no Gemini key.

This is not a bug to design around — it falls directly out of the rule that a key must
never leave the device, which `docs/architecture/v1-architecture-decisions.md` calls "a
property of BYO-key generation, not a v1 shortcut". It is a screen (110g), reached from
Settings and from all three surfaces outside it, with both ways out on it: add the key here,
or generate with a key this device already has — which changes the choice everywhere, and
says so.

## What the extension has to ask for

Chrome will not let the extension reach a provider's address until it has been granted.
The six are `optional_host_permissions`, asked for one at a time when a key is added, and
given back when it is removed.

**Required permissions were rejected.** Six origins in `host_permissions` would meet a new
reader with a permission sheet naming six companies before they had agreed to anything, and
would disable the extension on update until they accepted. The cost of the optional route is
that Save key raises a Chrome prompt we do not own the look of, and a reader can decline it:
nothing is saved, the key stays in the field, and Save key asks again.

`api.anthropic.com` moved out of `host_permissions` as part of this. The content-script
bridge in `youTubeFetchBridge.ts` is unchanged and still matters more than before: it is
what stops the extension being an open CORS proxy for every provider origin a reader has
granted.

## Migrations

- **Settings gained its first migration.** `model: AnthropicModel` became
  `provider` plus `modelByProvider`. A record written before the change was necessarily an
  Anthropic one, so the old value moves to `modelByProvider.anthropic` and the old field is
  dropped — a client reading both would have two answers to one question. The registry moved
  to 2, `CLIENT_VERSION` to 6, and `clientSchemaVersions.ts` has its row.
- **`modelByProvider` merges one level**, like `sectionsEnabled` and `milestones`: a device
  choosing a model for OpenAI must not drop the model another device chose for Gemini.
- **`provider` parses with `.catch`, and a model id is free text.** A model this client has
  never heard of must survive a read — the reader's key can reach it, and the picker offered
  it.
- **The stored keys moved to `overview.apiKeys.v2`.** The v1 record is read once if there is
  no v2 one, and left where it is, so going back to an older build still finds the key.
  Its `addedAt` is null: the older build never recorded one, and the row says nothing rather
  than inventing a date.

## Where the build departs from the design

- **110a's standfirst.** The design reads "To use the Bring Your Own key plans you'll need
  to supply your own API Key…". There are no BYO plans in the build — generation is BYO at
  every tier — so it reads "To write overviews you'll need your own API key from one of
  these providers." The design flags this itself as the OV-104 conflict below.
- **Model names and prices are real, not the design's placeholders**, taken from each
  provider's own documentation on 11 October 2026. They will go stale; the live fetch is
  what keeps the picker current, and `KNOWN_MODELS` is the floor under it.
- **No screenshot tests**, as with `settings.md`: this repo still has no screenshot harness.
  The states are covered by `settingsKeys.iwft.ts` and the scenarios that seed keys.

## Open, and deliberately not settled here

**The OV-104 conflict, raised by the design itself.** This feature assumes generation is
bring-your-own-key at every tier, which is what the build does. OV-104 proposes 10 overviews
a month on our key for every account. If that ships, 110a and the first-run prompt need a
line for "on us", and the at-limit routes into Settings › API keys still hold. Nothing here
blocks it; the copy would change.

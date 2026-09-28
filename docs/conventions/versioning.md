# Versioning

One number, `version` in the root `package.json`, names every build of the web app and
the extension. `docs/architecture/deploy.md` covers how it is stamped in, tagged and
released; this is what the number means and when to move it.

## Three numbers, three jobs

The product has three version numbers, and they must not be confused, because each
answers a different question and each is moved for a different reason.

| The number | Where | Answers | Moves when |
|---|---|---|---|
| `version` in the root `package.json` | Settings, the store, the tag and release | "which release is this person running?" | a person decides a release is worth naming |
| `CLIENT_VERSION` in `packages/domain` | the sync handshake, `MIN_SUPPORTED_CLIENT_VERSION` on the server | "can this client still talk to the server?" | the wire contract or a record schema changes (`docs/features/sync-api.md`, `docs/features/record-migrations.md`) |
| `CURRENT_SCHEMA_VERSIONS` per record kind | inside each stored record | "can this build read this record?" | a record's shape changes (`docs/features/record-migrations.md`) |

The first is for people and is semver. The other two are integers for machines and are
never bumped for a release's sake; they move exactly when the thing they guard changes,
and a test fails if one moves without the other. A release that changes the wire contract
therefore bumps two numbers, and the semver one says so in its size.

## The shape: `major.minor.patch`

Before `1.0.0` the rules are the ones that make sense for one product used by a few
people, not the library rules semver was written for. Nothing here has a public API whose
breakage is what `major` would classically mean.

**Patch** is a release that changes nothing a person would need telling about. Fixes,
copy, a layout nudge, a dependency, something faster. If the store listing's description
would not change and no note on Settings is needed, it is a patch. Most releases are.

**Minor** is a release with something new to notice, or something that behaves
differently on purpose. A new panel, a new capability of the extension, a changed
verdict scale, a note format change that touches `prototype/summary-prompt.md`, a
`CLIENT_VERSION` move. If a sentence in the store listing or the README would be added or
rewritten, it is at least a minor.

**Major** is reserved for `1.0.0`, and after that for a release that a person has to act
on: sign in again, re-grant a permission, lose or migrate a library, or a floor raised so
that older builds are refused by the server. Before `1.0.0` those still happen as minors,
because `0.x` is the signal that they can.

**`1.0.0`** is the release where the premise in `README.md` has been answered and the
product is offered to people who did not build it. It is not a technical milestone.

When in doubt between two sizes, take the larger one. The number is cheap; a person who
missed that something changed is not.

## When to bump at all

`docs/architecture/deploy.md` has the mechanics; the rule is short. Nothing bumps for
you. The web app deploys on every merge and does not need a new number to do so; a
web-only change ships under the current version and Settings shows the commit. The number
has to move when an extension zip is going to the store, because the store refuses a
version that has not risen. So: bump in the PR whose zip you intend to upload, sized by
everything merged since the last tag rather than by that PR alone, and otherwise leave it.

```
task version:bump -- patch       # or minor, major
```

The bump edits the root `package.json` and nothing else; commit it in that PR. Never tag
by hand: the deploy job tags the merge that first ships each number, and a tag made any
other way would claim a deploy that did not happen.

## What not to do

- Do not bump for a merge that ships no zip, to make the number "current". The commit
  on Settings already says which build it is; a version with no release behind it is a
  gap in the tag list that later has to be explained.
- Do not move `CLIENT_VERSION` or a schema version as part of a release bump. They have
  their own rules and their own tests.
- Do not touch the `0.0.0` in any workspace's `package.json`. Those are placeholders and
  the build ignores them; only the root's is read.

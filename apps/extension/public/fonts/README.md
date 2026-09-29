# Self-hosted fonts

Gloock and Figtree, latin and latin-ext subsets, taken from Google Fonts' `css2` API on
2026-09-29. Self-hosted rather than linked so the side panel makes no third-party request
when it opens — see `docs/architecture/v1-architecture-decisions.md`.

Figtree is a variable font: one file per subset carries every weight, which is why
`fonts.css` declares `font-weight: 400 700` for it. Gloock has one weight.

Both families are licensed under the SIL Open Font License 1.1; each family's licence
text sits beside its files. `fonts.css` is the `@font-face` block Google Fonts served,
with the remote URLs rewritten to these local paths (docs/features/stone-theme.md).

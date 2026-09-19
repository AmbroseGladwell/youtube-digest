# The extension's icon

`icon.svg` is the source: the brand mark from the masthead, reversed out of `--ink` in
the accent — the same mark the web app already carries as its favicon
(`apps/web/index.html`). The solid ground is what makes it work as a toolbar icon: the
masthead's mark is a thin stroke in `currentColor`, which would disappear against
Chrome's own chrome in one theme or the other.

The PNGs beside it are generated, and committed because Chrome's manifest can only point
at files that exist in the packaged extension — `icons` and `action.default_icon` take
raster images, so an SVG can't be named there even though both extension documents
reference `icon.svg` directly for their own favicon.

Regenerate them after any change to `icon.svg`, from the repo root:

```
node scripts/renderExtensionIcons.ts
```

Nothing enforces that. If the mark changes, `icon.svg`, these PNGs and the favicon data
URI in `apps/web/index.html` all have to move together.

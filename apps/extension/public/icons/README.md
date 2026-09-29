# The extension's icon

The mark is the ring and underline from the masthead, in the brand orange, **on a
transparent ground**. Nothing is painted behind it: the ring sits directly on whatever
Chrome puts behind it, in either theme.

These files come from the design project's logo pack (`Logo Pack.dc.html`, the
`chrome-extension/` folder) and are not generated here. The 16 and 32 px icons carry a
slightly heavier stroke than the others so the ring stays open at toolbar size, and
`icon128.png` follows the Web Store's guidance of 96 px of artwork inside 16 px of
transparent padding. That tuning is per size and cannot be recovered by scaling one
source down, which is why there is no longer a render script: replacing these means
exporting them again from the pack.

`icon.svg` is the same mark at any size. Chrome's manifest takes raster icons only, so
`icons` and `action.default_icon` name the PNGs, while both extension documents use the
SVG directly for their own favicon.

The PNGs were stripped of their C2PA metadata on the way in — several kilobytes of
content credentials on a 16 px icon, in a package where every kilobyte ships. The signed
originals stay in the design project.

The web app's favicon set is the same mark from the same pack, under
`apps/web/public/` (docs/features/stone-theme.md, "The mark").

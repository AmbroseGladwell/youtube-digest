# Themes

Nothing in this project has a theming system yet — this is a general pattern
worth knowing about if one gets built, not a description of anything that
exists here. The specific file paths and class names from the codebase this
was originally brought in from have been removed; what's left is the
underlying idea.

## The pattern

A semantic theming system doesn't let component code reach for a raw colour or
value directly. Instead, CSS custom properties are resolved to the correct
value at runtime, and components consume a semantic name (`error-colour`,
`border-colour`) rather than a literal one. Dark mode and any other theme
variant are then just a different set of values bound to the same custom
properties — no component code needs to know a theme exists.

**Names should describe what a value represents, not where it's used.**
`error-colour` is reusable; `banner-error-colour` bakes in one feature and
stops being reusable the moment another feature needs the same colour with a
different value. A feature that genuinely needs its own variant is better
served by a scoped override (see below) than by a new globally-named token.

**Local overrides, not new globals.** CSS custom properties can be
re-bound within a specific container without affecting the rest of the page —
useful when one feature or component needs different values than the rest of
the app (a panel that's always dark regardless of the page's theme, for
example). Prefer overriding an existing semantic value locally over inventing
a feature-specific token for it.

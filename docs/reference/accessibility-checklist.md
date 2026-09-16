# Accessibility Checklist

Target: WCAG 2.2 Level AA. Use this checklist when reviewing UI changes.

## Keyboard accessibility

- [ ] All interactive elements (buttons, links, inputs, custom widgets) are reachable and operable by keyboard alone
- [ ] Focus order follows a logical reading sequence — no unexpected jumps
- [ ] Focus is visible at all times (do not suppress the focus ring without a replacement style)
- [ ] Modals and drawers trap focus while open and restore it to the trigger element on close
- [ ] Escape closes modals, drawers, and menus

## Semantic HTML and ARIA

- [ ] Interactive elements use the correct element (`<button>` for actions, `<a>` for navigation) — avoid `div` / `span` with click handlers
- [ ] Prefer React Aria Components for complex widgets (menus, dialogs, comboboxes, etc.) rather than rolling custom ARIA
- [ ] All `aria-label` / `aria-labelledby` values are accurate and do not duplicate visible text unnecessarily
- [ ] `aria-expanded`, `aria-selected`, `aria-checked`, and similar state attributes update correctly
- [ ] Decorative images have `alt=""` and are hidden from assistive technology; meaningful images have descriptive `alt` text
- [ ] Heading hierarchy is logical (`h1` → `h2` → `h3`); headings are not skipped when considering the full page context — a component that starts at `h3` is fine if the surrounding page provides `h1` and `h2`

## Forms

- [ ] Every input has an associated visible label (or an `aria-label` / `aria-labelledby` when a visible label is not possible)
- [ ] Validation errors are associated with their input via `aria-describedby` and announced to screen readers
- [ ] Required fields are indicated both visually and programmatically (`aria-required="true"` or `required`)

## Dynamic content and live regions

- [ ] Status messages (toasts, loading states, operation results) are announced via a persistent `aria-live` region — do not inject a new `role="alert"` element dynamically, as VoiceOver is unreliable at announcing it
- [ ] Loading spinners have an accessible label (e.g. `aria-label="Loading"`) and the live region announces completion

## Color and visual design

- [ ] Normal text meets 4.5:1 contrast ratio against its background
- [ ] Large text (18px+ regular or 14px+ bold) meets 3:1 contrast ratio
- [ ] UI components (input borders, focus rings, icons) meet 3:1 contrast ratio against adjacent colours
- [ ] Information is not conveyed by colour alone — a secondary indicator (icon, label, pattern) is also present

## Motion

- [ ] Animations and transitions respect `prefers-reduced-motion` — either remove or substantially reduce motion when the preference is set

## Links and buttons

- [ ] Link and button text is descriptive in isolation (not "click here", "read more", or "submit" without context)
- [ ] Icon-only buttons have an accessible label (`aria-label` or visually-hidden text)

## Text sizing

- [ ] `font-size` is set in `rem` (not `px`) so text scales with the user's browser/OS font-size preference
- [ ] Prefer design-system font tokens (e.g. `$font-size`, `$caption-size-small`) over raw `rem` values; fall back to a raw `rem` only when no token matches the required size
- [ ] `line-height` is unitless (or relative) so it scales with the font size rather than pinning it

## Reflow (zoom and narrow viewports)

These items can be partially checked via static analysis but **must be verified visually at 320px viewport width or 400% browser zoom** — static flags are indicators, not confirmed bugs.

- [ ] No content is clipped or overlaps at 320px viewport width or 400% browser zoom — verify visually
- [ ] Containers use fluid widths (`%`, `vw`) and responsive constraints (`min-width`/`max-width`) rather than fixed `px` widths wider than 320px
- [ ] Text containers do not have `overflow: hidden` or `white-space: nowrap` that would clip or truncate content at narrow widths
- [ ] Fixed heights on elements containing text include `overflow: auto` or `visible` so content is not cut off when zoomed
- [ ] Flex rows use `flex-wrap: wrap` (or items have sufficient shrink budget) so they do not overflow horizontally
- [ ] Images and media have `max-width: 100%` so they do not exceed their container
- [ ] `position: fixed` and `position: absolute` elements do not obscure content at narrow widths — verify visually

export const OVERVIEW_BUTTON_ID = "overview-injected-button";

const STYLE_ID = "overview-injected-button-style";

// Design 18a and 18c, transcribed. The pill is YouTube's own — a faint top-to-bottom
// lift and a hairline edge, in both schemes — and the only thing that is ours is the
// mark. YouTube puts `dark` on <html>, which is why the scheme needs no JavaScript.
//
// 40px tall, where the design draws 36: matching the row is the whole point of this
// treatment, and the row has since grown. The radius is half the height or it stops
// being a pill (docs/features/injected-button.md).
//
// Both inset lines are half the design's opacity — the top highlight also at half its
// thickness. Drawn as given, the pill was the brightest thing in the action row, which
// is the opposite of what the quietest of the three treatments is for.
//
// The accent hairline on the ready pill is not reduced with them: there it is carrying
// a state rather than describing an edge.
//
// The ready hover is the one value 18c does not draw; it is 18b's hover on the same
// accent pill rather than something invented (docs/features/injected-button.md).
const CSS = `
#${OVERVIEW_BUTTON_ID} {
  position: relative;
  display: inline-flex;
  align-items: center;
  align-self: center;
  flex: 0 0 auto;
  gap: 8px;
  /* The native row sets no gap of its own, so the button carries the 8px design 18a
     leaves between the pills. Logical, so it stays on the leading edge in RTL. */
  margin-inline-start: 8px;
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  font-family: Roboto, Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
  transition: background 120ms ease-out, box-shadow 120ms ease-out, color 120ms ease-out;
}

/* Which parts show is read off the one state attribute rather than toggled separately
   in script: each of these outranks the base rule below it on its own, so there is no
   ordering to get wrong later. */
#${OVERVIEW_BUTTON_ID}[data-state="generating"] .ovb-mark { display: none; }
#${OVERVIEW_BUTTON_ID}:not([data-state="generating"]) .ovb-spinner { display: none; }
#${OVERVIEW_BUTTON_ID}:not([data-state="generating"]) .ovb-bar { display: none; }

#${OVERVIEW_BUTTON_ID} .ovb-mark { display: inline-flex; color: var(--ovb-mark); }

#${OVERVIEW_BUTTON_ID} .ovb-spinner {
  width: 15px;
  height: 15px;
  border: 2.4px solid var(--ovb-mark);
  border-top-color: transparent;
  border-radius: 999px;
  animation: ovb-spin 1s linear infinite;
}

#${OVERVIEW_BUTTON_ID} .ovb-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: var(--ovb-mark);
  transition: width 240ms cubic-bezier(.2,.7,.2,1);
}

@keyframes ovb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  #${OVERVIEW_BUTTON_ID} { transition: none; }
  #${OVERVIEW_BUTTON_ID} .ovb-spinner { animation: none; }
  #${OVERVIEW_BUTTON_ID} .ovb-bar { transition: none; }
}

html:not([dark]) #${OVERVIEW_BUTTON_ID} {
  --ovb-mark: #E2511E;
  background: linear-gradient(180deg, #f6f6f6 0%, #ececec 100%);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(0,0,0,.025);
  color: #0f0f0f;
}
html:not([dark]) #${OVERVIEW_BUTTON_ID}:hover {
  background: linear-gradient(180deg, #eaeaea 0%, #e0e0e0 100%);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(0,0,0,.035);
}
html:not([dark]) #${OVERVIEW_BUTTON_ID}[data-state="ready"] {
  background: linear-gradient(180deg, #fdf0ea 0%, #f8e2d8 100%);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(226,81,30,.36);
  color: #8f3210;
}
html:not([dark]) #${OVERVIEW_BUTTON_ID}[data-state="ready"]:hover {
  background: linear-gradient(180deg, #fbe5da 0%, #f4d5c7 100%);
}

html[dark] #${OVERVIEW_BUTTON_ID} {
  --ovb-mark: #F0794A;
  background: linear-gradient(180deg, #303030 0%, #262626 100%);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.05), inset 0 0 0 1px rgba(255,255,255,.02);
  color: #f1f1f1;
}
html[dark] #${OVERVIEW_BUTTON_ID}:hover {
  background: linear-gradient(180deg, #414141 0%, #363636 100%);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.03);
  color: #fff;
}
html[dark] #${OVERVIEW_BUTTON_ID}[data-state="ready"] {
  background: linear-gradient(180deg, #3a2a22 0%, #2c1f19 100%);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.04), inset 0 0 0 1px rgba(240,121,74,.4);
  color: #F0794A;
}
html[dark] #${OVERVIEW_BUTTON_ID}[data-state="ready"]:hover {
  background: linear-gradient(180deg, #4a352a 0%, #3a2820 100%);
}
`;

export function ensureOverviewButtonStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

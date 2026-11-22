import { prefersReducedMotion } from "../../../util/prefersReducedMotion.js";

export const TRAVEL_MS = 520;
export const ARRIVING_ATTRIBUTE = "data-chat-arriving";

const easeOut = (t: number) => 1 - (1 - t) ** 3;

const arriving = () => document.querySelector<HTMLElement>(`[${ARRIVING_ATTRIBUTE}]`);

// Design 310a-4–310a-6: a copy of the tapped bubble, or of the typed question, lifts off and
// travels into the chat as its question, narrowing to fit and following the chat every frame
// while it slides in. The question it lands as stays hidden until it arrives. Nothing travels
// with reduced motion.
export function bubbleTravel(from: HTMLElement, text: string): void {
  if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
    return;
  }
  const start = from.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.textContent = text;
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    margin: "0",
    boxSizing: "border-box",
    zIndex: "60",
    pointerEvents: "none",
    padding: "10px 14px",
    borderRadius: "18px 18px 4px 18px",
    background: "var(--surface)",
    color: "var(--ink)",
    font: "500 14.5px/1.45 var(--font-body)",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.28)",
  });
  document.body.appendChild(ghost);
  let hidden: HTMLElement | null = null;
  const began = performance.now();

  const frame = (now: number) => {
    const progress = Math.min(1, (now - began) / TRAVEL_MS);
    const target = arriving();
    if (target !== null && target !== hidden) {
      hidden?.style.removeProperty("visibility");
      hidden = target;
      target.style.visibility = "hidden";
    }
    if (target !== null) {
      const to = target.getBoundingClientRect();
      const eased = easeOut(progress);
      ghost.style.left = `${start.left + (to.left - start.left) * eased}px`;
      ghost.style.top = `${start.top + (to.top - start.top) * eased}px`;
      ghost.style.width = `${start.width + (to.width - start.width) * eased}px`;
    }
    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }
    ghost.remove();
    hidden?.style.removeProperty("visibility");
  };
  requestAnimationFrame(frame);
}

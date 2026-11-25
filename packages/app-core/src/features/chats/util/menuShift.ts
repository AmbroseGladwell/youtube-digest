const EDGE = 16;

export interface HostEdges {
  left: number;
  right: number;
}

export const menuShift = (host: HostEdges, width: number, bounds: HostEdges, align: "start" | "end"): number => {
  const roomRight = bounds.right - host.left;
  const roomLeft = host.right - bounds.left;
  const toEnd = align === "end" ? roomLeft >= width || roomLeft >= roomRight : roomRight < width && roomLeft > roomRight;
  const preferred = toEnd ? host.right - width : host.left;
  const kept = Math.max(bounds.left + EDGE, Math.min(preferred, bounds.right - EDGE - width));
  return Math.round(kept - host.left);
};

export const clippingEdges = (element: Element): HostEdges => {
  let left = 0;
  let right = window.innerWidth;
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowX !== "visible") {
      const box = parent.getBoundingClientRect();
      left = Math.max(left, box.left);
      right = Math.min(right, box.right);
    }
  }
  return { left, right };
};

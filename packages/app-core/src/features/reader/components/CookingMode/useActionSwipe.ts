import { useRef, useState, type PointerEvent } from "react";

export const SWIPE_PX = 56;
const DRAG_RESISTANCE = 0.6;
const DRAG_MOST_PX = 120;
const MOSTLY_VERTICAL = 1.5;

interface Start {
  id: number;
  x: number;
  y: number;
}

export interface ActionSwipe {
  dragY: number;
  dragging: boolean;
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
}

// Swipe up for the next action and down for the last one (OV-158). The action follows the finger
// while it drags, and a short or mostly sideways drag springs back.
export function useActionSwipe(onUp: () => void, onDown: () => void, enabled: boolean): ActionSwipe {
  const start = useRef<Start | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    start.current = null;
    setDragging(false);
    setDragY(0);
  };

  return {
    dragY,
    dragging,
    handlers: {
      onPointerDown: (event) => {
        if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
        if ((event.target as HTMLElement).closest("button, a")) return;
        start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event) => {
        const from = start.current;
        if (from === null || from.id !== event.pointerId) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        if (Math.abs(dy) <= Math.abs(dx)) return;
        setDragging(true);
        setDragY(Math.max(-DRAG_MOST_PX, Math.min(DRAG_MOST_PX, dy * DRAG_RESISTANCE)));
      },
      onPointerUp: (event) => {
        const from = start.current;
        if (from === null || from.id !== event.pointerId) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        reset();
        if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx) * MOSTLY_VERTICAL) return;
        if (dy < 0) onUp();
        else onDown();
      },
      onPointerCancel: reset,
    },
  };
}

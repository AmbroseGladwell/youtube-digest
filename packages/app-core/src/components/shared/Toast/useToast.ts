import { useEffect, useState } from "react";

export const TOAST_MS = 4000;
export const UNDO_TOAST_MS = 6000;

export interface ToastMessage {
  text: string;
  done: boolean;
  key: number;
  undo: (() => void) | null;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timer = setTimeout(() => setToast(null), toast.undo === null ? TOAST_MS : UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    toast,
    show: (text: string, done: boolean, undo: (() => void) | null = null) => setToast({ text, done, key: Date.now(), undo }),
    dismiss: () => setToast(null),
  };
};

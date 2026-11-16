import { useEffect, useState } from "react";

export const TOAST_MS = 4000;

export interface ToastMessage {
  text: string;
  done: boolean;
  key: number;
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    toast,
    show: (text: string, done: boolean) => setToast({ text, done, key: Date.now() }),
  };
}

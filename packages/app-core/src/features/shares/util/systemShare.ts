export interface SystemShare {
  title: string;
  url: string;
}

export const canShareToSystem = (): boolean => typeof navigator.share === "function";

export const shareToSystem = async (share: SystemShare): Promise<void> => {
  try {
    await navigator.share(share);
  } catch (error) {
    // Dismissing the system sheet throws, and is not a failure.
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    throw error;
  }
};

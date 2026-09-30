export interface SystemShare {
  title: string;
  url: string;
}

// navigator.share exists on a phone and in almost nothing else, and it throws when the
// reader dismisses the sheet, which is not a failure. Where it is absent the dialog puts
// Copy link in the primary slot instead of offering a control that cannot work
// (docs/features/sharing.md).
export const canShareToSystem = (): boolean => typeof navigator.share === "function";

export async function shareToSystem(share: SystemShare): Promise<void> {
  try {
    await navigator.share(share);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    throw error;
  }
}

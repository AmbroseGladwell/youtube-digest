export type BulkAction =
  | { kind: "read" | "unread" | "favourite" | "unfavourite" | "deleted"; overviews: number }
  | { kind: "added" | "removed"; overviews: number; place: string }
  | { kind: "updated"; places: number; noun: "project" | "topic" };

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function doneText(action: BulkAction): string {
  switch (action.kind) {
    case "read":
      return `${action.overviews} marked read`;
    case "unread":
      return `${action.overviews} marked unread`;
    case "favourite":
      return `${action.overviews} added to favourites`;
    case "unfavourite":
      return `${action.overviews} removed from favourites`;
    case "deleted":
      return `${action.overviews} deleted`;
    case "added":
      return `Added ${action.overviews} to ${action.place}`;
    case "removed":
      return `Removed ${action.overviews} from ${action.place}`;
    case "updated":
      return `Updated ${plural(action.places, action.noun)}`;
  }
}

function failedText(action: BulkAction, share: string): string {
  switch (action.kind) {
    case "read":
      return `Couldn’t mark ${share} read`;
    case "unread":
      return `Couldn’t mark ${share} unread`;
    case "favourite":
      return `Couldn’t add ${share} to favourites`;
    case "unfavourite":
      return `Couldn’t remove ${share} from favourites`;
    case "deleted":
      return `Couldn’t delete ${share}`;
    case "added":
      return `Couldn’t add ${share} to ${action.place}`;
    case "removed":
      return `Couldn’t remove ${share} from ${action.place}`;
    case "updated":
      return `Couldn’t make ${share} changes`;
  }
}

export function bulkActionToast(
  action: BulkAction,
  { writes, failed }: { writes: number; failed: number },
): { text: string; done: boolean } {
  if (failed === 0) {
    return { text: doneText(action), done: true };
  }
  return { text: failedText(action, `${failed} of ${writes}`), done: false };
}

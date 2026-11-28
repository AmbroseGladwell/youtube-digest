import {
  paceDailyLimit,
  queueOriginOf,
  type PlaylistOrder,
  type PlaylistPace,
  type QueueOrigin,
  type QueuedCapture,
} from "@overview/domain";
import { orderInASentence } from "../../playlists/util/orderCopy.js";
import { paceInASentence } from "../../playlists/util/paceCopy.js";
import { resetDate } from "../../newOverview/util/usageLine.js";

type PaceOf = (originId: string) => PlaylistPace;
type OrderOf = (originId: string) => PlaylistOrder;

const onlyPlaylist = (captures: readonly QueuedCapture[]): QueueOrigin | null => {
  const playlists = [...new Map(captures.map((capture) => [queueOriginOf(capture).id, queueOriginOf(capture)])).values()];
  return playlists.length === 1 ? playlists[0]! : null;
};

const paceStays = (captures: readonly QueuedCapture[], paceOf: PaceOf): string => {
  const playlist = onlyPlaylist(captures);
  if (playlist === null) {
    return "Paces stay as they are.";
  }
  const pace = paceOf(playlist.id);
  return paceDailyLimit(pace) === 0
    ? `The rest of ${playlist.title} keep waiting for you.`
    : `${playlist.title} stays at ${paceInASentence(pace)}.`;
};

const madeInOrder = (captures: readonly QueuedCapture[], orderOf: OrderOf): string => {
  const playlist = onlyPlaylist(captures);
  return playlist === null ? "Made next, in each playlist’s order." : `Made next, ${orderInASentence(orderOf(playlist.id))}.`;
};

export interface MonthAllowance {
  left: number;
  resetsOn: string;
}

export const madeNowOf = (chosen: number, allowance: MonthAllowance | null): number =>
  allowance === null ? chosen : Math.min(chosen, allowance.left);

export const chosenBarLine = (
  captures: readonly QueuedCapture[],
  paceOf: PaceOf,
  orderOf: OrderOf,
  allowance: MonthAllowance | null = null,
): string => {
  const made = madeNowOf(captures.length, allowance);
  if (allowance === null || made === captures.length) {
    return `${madeInOrder(captures, orderOf)} ${paceStays(captures, paceOf)}`;
  }
  const rest = captures.length - made;
  return (
    `You have ${made.toLocaleString("en-GB")} left this month, so ${made.toLocaleString("en-GB")} ${made === 1 ? "is" : "are"} made now ` +
    `and the other ${rest.toLocaleString("en-GB")} ${rest === 1 ? "waits" : "wait"} for ${resetDate(allowance.resetsOn)}. ${paceStays(captures, paceOf)}`
  );
};

export interface MadeNowNotice {
  lead: string;
  rest: string;
}

export const madeNowNotice = (captures: readonly QueuedCapture[], paceOf: PaceOf): MadeNowNotice => {
  const lead = captures.length === 1 ? `Making “${captures[0]!.title}” next.` : `Making ${captures.length.toLocaleString("en-GB")} next.`;
  return { lead, rest: paceStays(captures, paceOf) };
};

export const makeChosenLabel = (count: number): string => {
  return count === 1 ? "Make it now" : `Make ${count.toLocaleString("en-GB")} now`;
};

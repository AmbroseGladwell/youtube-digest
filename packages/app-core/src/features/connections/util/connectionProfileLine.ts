export const connectionProfileLine = (readsProfile: boolean, sharingProfile: boolean): string => {
  if (!readsProfile) {
    return "Can’t read what we know about you until it’s reconnected";
  }
  return sharingProfile ? "Can read what we know about you" : "Can’t read what we know about you: it’s off in Personalisation";
};

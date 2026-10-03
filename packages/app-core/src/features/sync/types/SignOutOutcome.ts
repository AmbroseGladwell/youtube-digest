// How a sign-out's last sync left things: what it couldn't send, what the server had
// refused, whether the device was offline, and whether the sync was given up on.
export interface SignOutOutcome {
  pending: number;
  stuck: number;
  offline: boolean;
  timedOut: boolean;
}

export interface SignOutOptions {
  // Run with the session still alive, so what is recorded here can still be sent.
  beforeEndingSession?: (outcome: SignOutOutcome) => Promise<void>;
}

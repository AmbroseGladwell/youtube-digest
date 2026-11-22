export interface SignOutOutcome {
  pending: number;
  // Writes the server refused, which nothing will send again.
  stuck: number;
  offline: boolean;
  timedOut: boolean;
}

export interface SignOutOptions {
  // Runs with the session still alive, so what it records can still be sent.
  beforeEndingSession?: (outcome: SignOutOutcome) => Promise<void>;
}

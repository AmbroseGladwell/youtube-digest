// What the move on sign-in did: overviews added to the account, and overviews of videos
// the account already had, whose copies here were let go (design 47e).
export interface LibraryMove {
  moved: number;
  alreadyThere: number;
}

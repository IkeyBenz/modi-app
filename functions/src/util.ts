import { auth } from "firebase-admin";

const adminAuth = auth();

export async function getUsername(userId: string): Promise<string> {
  const user = await adminAuth.getUser(userId);
  return user.displayName || "Unknown Player";
}

/**
 * Helper function to find the next alive player to the left of a given player
 */
export function findNextAlivePlayerToLeft(
  players: string[],
  playerLives: { [playerId: string]: number },
  currentPlayerId: string
): string | null {
  const currentIndex = players.indexOf(currentPlayerId);
  if (currentIndex === -1) {
    return null;
  }

  // Start from the next player to the left and go around the circle
  for (let i = 1; i <= players.length; i++) {
    const playerIndex = (currentIndex + i) % players.length;
    const playerId = players[playerIndex];
    if (playerLives[playerId] > 0) {
      return playerId;
    }
  }

  return null; // No alive players found
}
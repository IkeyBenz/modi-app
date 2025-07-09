import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { InitialGame } from "./types";

const db = getFirestore();

export interface CreateGameRequest {
  username: string;
}

export interface CreateGameResponse {
  gameId: string;
}

export const createGame = onCall<CreateGameRequest, Promise<CreateGameResponse>>(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("CreateGame:User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  const gameId = await generateGameId();
  console.debug("CreateGame: Generated game id:", gameId);

  const game: InitialGame & { actionCount: number } = {
    gameId,
    status: "gathering-players",
    players: [userId],
    host: userId,
    usernames: { [userId]: request.data.username },
    actionCount: 0, // Initialize action count
  }
  
return db.doc(`games/${gameId}`).set(game).then(() => {
  }).then((res) => {
    console.info("CreateGame: Game document created:", res);
    return { gameId };
  }).catch((err) => {
    console.error("CreateGame: Error creating game document:", err);
    throw new HttpsError("internal", "Error creating game document");
  });
});

async function generateGameId() {
  let gameId: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    gameId = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
  } while (await isGameIdExists(gameId) && attempts < maxAttempts);

  return gameId;
}

async function isGameIdExists(gameId: string) {
  const gameRef = db.collection("games").doc(gameId);
  const game = await gameRef.get();
  return game.exists;
}
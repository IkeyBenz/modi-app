/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { initializeApp } from "firebase-admin/app";

// Set global options for cost control
import { setGlobalOptions } from "firebase-functions";

// Initialize Firebase Admin
initializeApp();

// Get Firestore instance
// const db = getFirestore();
setGlobalOptions({ maxInstances: 10 });

export { createGame } from "./createGame";
export { dealCards } from "./dealCards";
export { endRound } from "./endRound";
export { joinGame } from "./joinGame";
export { leaveGame } from "./leaveGame";
export { setPlayerOrder } from "./setPlayerOrder";
export { startGame } from "./startGame";
export { stick } from "./stick";
export { swapCard } from "./swapCard";


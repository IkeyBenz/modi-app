import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore, isFirebaseConfigured } from "@/config/firebase";
import { useUserId } from "@/providers/Auth";

const STORAGE_KEY = "@modi/username";

export function useUsername() {
  const { getItem, setItem } = useAsyncStorage(STORAGE_KEY);
  const [username, setUsernameState] = useState("");
  const userId = useUserId();

  useEffect(() => {
    async function fetchUsername() {
      let cloudName: string | null = null;

      if (isFirebaseConfigured && userId) {
        try {
          const userRef = doc(firestore, `users/${userId}`);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as { username?: string };
            if (data.username) {
              cloudName = data.username;
            }
          }
        } catch (err) {
          console.error("Failed to fetch username from Firestore", err);
        }
      }

      if (cloudName) {
        setUsernameState(cloudName);
        setItem(cloudName);
      } else {
        const val = await getItem();
        if (val) setUsernameState(val);
      }
    }

    fetchUsername();
  }, [getItem, setItem, userId]);

  const setUsername = useCallback(
    async (name: string) => {
      setUsernameState(name);
      setItem(name);

      if (isFirebaseConfigured && userId) {
        try {
          const userRef = doc(firestore, `users/${userId}`);
          await setDoc(userRef, { username: name }, { merge: true });
        } catch (err) {
          console.error("Failed to set username in Firestore", err);
        }
      }
    },
    [setItem, userId]
  );

  return { value: username, setValue: setUsername };
}

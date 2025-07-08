import React, { useContext, useRef, useState } from "react";

export interface PlayerPosition {
  x: number;
  y: number;
}

interface PlayerPositionContextType {
  registerPlayerPosition: (playerId: string, pos: PlayerPosition) => void;
  getPlayerPositions: () => { [playerId: string]: PlayerPosition };
}

const PlayerPositionContext = React.createContext<
  PlayerPositionContextType | undefined
>(undefined);

export const PlayerPositionProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const positionsRef = useRef<{ [playerId: string]: PlayerPosition }>({});
  const [, forceUpdate] = useState(0);

  const registerPlayerPosition = (playerId: string, pos: PlayerPosition) => {
    positionsRef.current[playerId] = pos;
    forceUpdate((n) => n + 1); // trigger re-render for consumers
  };
  const getPlayerPositions = () => positionsRef.current;

  return (
    <PlayerPositionContext.Provider
      value={{ registerPlayerPosition, getPlayerPositions }}
    >
      {children}
    </PlayerPositionContext.Provider>
  );
};

export function usePlayerPositionContext() {
  const ctx = useContext(PlayerPositionContext);
  if (!ctx)
    throw new Error(
      "usePlayerPositionContext must be used within PlayerPositionProvider"
    );
  return ctx;
}

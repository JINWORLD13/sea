import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  selectDisplayShips,
  useShipStore,
} from "../store/useShipStore";
import type { ShipData } from "../store/useShipStore";

interface ShipSnapshotOptions {
  pause?: boolean;
  delayMs?: number;
  resumeDelayMs?: number;
}

export function useShipSnapshot(
  options: ShipSnapshotOptions = {},
): Record<string, ShipData> {
  const { pause = false, delayMs = 400, resumeDelayMs = 80 } = options;
  const [ships, setShips] = useState<Record<string, ShipData>>(() =>
    selectDisplayShips(useShipStore.getState()),
  );
  const pendingShipsRef = useRef<Record<string, ShipData>>(ships);
  const pauseRef = useRef<boolean>(pause);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleSnapshot = useCallback(
    (
      nextShips: Record<string, ShipData>,
      delay: number,
      force = false,
    ): void => {
      pendingShipsRef.current = nextShips;
      if (pauseRef.current && !force) return;

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const latestShips = pendingShipsRef.current;
        startTransition(() => {
          setShips(latestShips);
        });
      }, delay);
    },
    [clearTimer],
  );

  useEffect(() => {
    pauseRef.current = pause;
    if (!pause) {
      scheduleSnapshot(pendingShipsRef.current, resumeDelayMs, true);
    }
  }, [pause, resumeDelayMs, scheduleSnapshot]);

  useEffect(() => {
    const unsubscribe = useShipStore.subscribe((state, previousState) => {
      if (state.ships !== previousState.ships) {
        scheduleSnapshot(state.ships, delayMs);
      }
    });

    return () => {
      unsubscribe();
      clearTimer();
    };
  }, [clearTimer, delayMs, scheduleSnapshot]);

  return ships;
}

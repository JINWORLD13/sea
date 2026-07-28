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

      // 스로틀 (트레일링): 타이머가 이미 걸려 있으면 최신 데이터만 갱신하고
      // 그 타이머가 발화하게 둔다. 매번 타이머를 리셋(디바운스)하면 스토어
      // 갱신 간격이 delay보다 짧은 동안 스냅샷이 영원히 갱신되지 않는다
      // (예: 1초 flush 주기 vs 1.2초 지연의 Analytics).
      // Trailing throttle: when a timer is pending, only update the payload and
      // let it fire. Resetting the timer each time (debounce) starves the view
      // whenever store updates arrive faster than `delay` — e.g. the 1s flush
      // cadence vs Analytics' 1.2s delay.
      if (!force && timerRef.current !== null) return;

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
    if (pause) {
      // 일시정지 직전에 걸린 타이머가 드래그 중에 발화해 커밋하는 것을 막는다.
      // Cancel any armed timer so it can't fire (and commit) mid-interaction.
      clearTimer();
    } else {
      scheduleSnapshot(pendingShipsRef.current, resumeDelayMs, true);
    }
  }, [pause, resumeDelayMs, scheduleSnapshot, clearTimer]);

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

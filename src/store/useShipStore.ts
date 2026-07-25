// 선박 상태 스토어(Zustand): 선박 병합·위험도(CPA/지오펜스) 계산·경보 피드·설정/함대를 관리한다.
// 타입은 ./shipTypes, 상수는 ./config, 영속화는 ./persistence, AIS 스트림은 ./aisStream 참조.
// Ship state store (Zustand): ship merging, CPA/geofence risk, the alert feed, settings & fleet.
// Types live in ./shipTypes, constants in ./config, persistence in ./persistence, AIS stream in ./aisStream.
import { create } from "zustand";
import {
  latLngToXY,
  cogSogToVelocity,
  calculateCPA,
} from "../utils/maritimeMath";
import { categoryFromTypeCode } from "../utils/aisTypes";
import type {
  AlertEntry,
  AppSettings,
  PathPoint,
  Region,
  ReplayGhost,
  ShipData,
  ShipKind,
  ShipPatch,
  ShipStore,
  UpdateOptions,
} from "./shipTypes";
import {
  CPA_FEED_DEDUPE_MS,
  MAX_ALERT_FEED,
  MAX_PATH_POINTS,
  MAX_TRACKED_SHIPS,
  RESTRICTED_ZONE_ALERT_MESSAGE,
  SHIP_STALE_MS,
  createInitialStreamStatus,
  regions,
} from "./config";
import {
  loadPersistedFleet,
  loadPersistedSettings,
  persistFleet,
  persistSettings,
  sanitizeSettings,
} from "./persistence";

// 공개 파사드 재노출 — 기존 "../store/useShipStore" import 경로를 그대로 유지한다.
// Public facade re-exports so existing "../store/useShipStore" import paths keep working.
export type {
  AisStreamStatus,
  AlertEntry,
  AppSettings,
  PathPoint,
  Region,
  RegionBounds,
  ReplayGhost,
  ShipAlert,
  ShipCategory,
  ShipData,
  ShipEta,
  ShipKind,
  ShipPatch,
  ShipStore,
  UpdateOptions,
} from "./shipTypes";
export {
  getProxyHttpUrl,
  startAisStream,
  stopAisStream,
  updateViewportSubscription,
} from "./aisStream";

export const selectDisplayShips = (
  state: ShipStore,
): Record<string, ShipData> => state.ships;

// ---------------------------------------------------------------------------
// 선박 병합
// Ship merging
// ---------------------------------------------------------------------------

function isSamePosition(
  left: { lat: number; lng: number } | undefined,
  right: { lat: number; lng: number },
): boolean {
  return left?.lat === right.lat && left.lng === right.lng;
}

// nullable 필드 병합: undefined는 "변경 없음", null은 "이번 보고에서 미상"으로
// 명시적으로 덮어쓴다(낡은 침로/방위가 화면에 남지 않도록).
// Merge rule for nullable fields: undefined = keep previous, explicit null
// overwrites (so stale COG/heading never lingers on screen).
function pickField<T>(next: T | undefined, previous: T): T {
  return next === undefined ? previous : next;
}

function buildMergedShip(
  id: string,
  existingData: ShipData | undefined,
  data: Partial<ShipData>,
): ShipData {
  const lastSeen = data.lastSeen ?? existingData?.lastSeen ?? Date.now();
  const position =
    data.position ?? existingData?.position ?? { lat: 0, lng: 0 };

  const lastPathPoint = existingData?.path[existingData.path.length - 1];
  let path: PathPoint[];
  if (data.position !== undefined && !isSamePosition(lastPathPoint, data.position)) {
    path = [
      ...(existingData?.path ?? []),
      { lat: data.position.lat, lng: data.position.lng, ts: lastSeen },
    ].slice(-MAX_PATH_POINTS);
  } else {
    path =
      existingData?.path ??
      (data.position !== undefined
        ? [{ lat: position.lat, lng: position.lng, ts: lastSeen }]
        : []);
  }

  const kind: ShipKind = data.kind ?? existingData?.kind ?? "vessel";
  const typeCode = pickField(data.typeCode, existingData?.typeCode ?? null);
  const category = categoryFromTypeCode(typeCode, kind);

  return {
    id,
    name: data.name ?? existingData?.name ?? "MMSI " + id,
    kind,
    typeCode,
    category,
    // 레거시 별칭은 항상 category를 따른다. Legacy alias always mirrors category.
    type: category,
    position,
    speed: data.speed ?? existingData?.speed ?? 0,
    cog: pickField(data.cog, existingData?.cog ?? null),
    heading: pickField(data.heading, existingData?.heading ?? null),
    navStatus: pickField(data.navStatus, existingData?.navStatus ?? null),
    destination: data.destination ?? existingData?.destination,
    eta: data.eta ?? existingData?.eta ?? null,
    imo: data.imo ?? existingData?.imo,
    callsign: data.callsign ?? existingData?.callsign,
    length: pickField(data.length, existingData?.length ?? null),
    width: pickField(data.width, existingData?.width ?? null),
    draught: pickField(data.draught, existingData?.draught ?? null),
    path,
    risk: data.risk ?? existingData?.risk,
    inRestrictedZone: data.inRestrictedZone ?? existingData?.inRestrictedZone,
    alerts: data.alerts ?? existingData?.alerts ?? [],
    lastSeen,
    fuel: null,
    motion: null,
    wind: null,
    historicalData: existingData?.historicalData ?? [],
  };
}

// ---------------------------------------------------------------------------
// 위험도 패스 (지오펜스 + CPA)
// Risk pass (geofence + CPA)
// ---------------------------------------------------------------------------

const isInRestrictedZone = (
  regionId: Region["id"],
  lat: number,
  lng: number,
): boolean =>
  regionId === "busan" &&
  lat > 35.08 &&
  lat < 35.1 &&
  lng > 129.0 &&
  lng < 129.05;

// CPA 위험 피드 중복 방지용 — MMSI별 마지막 피드 시각.
// Dedupe map for CPA feed entries — last feed timestamp per MMSI.
const recentCpaFeedByMmsi = new Map<string, number>();

// 지오펜싱 + 충돌 위험(CPA)을 단일 패스로 계산하여 한 번의 set으로 반영한다.
// 이전 구현은 선박마다 updateShip을 개별 호출해 매번 전체 ships 객체를
// 복사(O(n²))했고, 구독자에게 n번의 갱신 알림을 보내 큰 렌더 부하를 유발했다.
// 이제 변경된 선박만 copy-on-write로 갱신하고 단일 알림만 발생시킨다.
//
// Geofencing + collision risk (CPA) are computed in a single pass and applied
// with one set(). The previous code called updateShip per ship, copying the
// whole ships object each time (O(n²)) and emitting n subscriber notifications.
// Now only changed ships are cloned (copy-on-write) with a single notification.
function computeRiskUpdates(state: ShipStore): Partial<ShipStore> {
  const regionId = state.currentRegion.id;
  const selectedId = state.selectedShipMmsi;
  const myShip = selectedId !== null ? state.ships[selectedId] : undefined;

  let myPos: ReturnType<typeof latLngToXY> | null = null;
  let myVel: ReturnType<typeof cogSogToVelocity> | null = null;
  if (myShip !== undefined) {
    myPos = latLngToXY(
      myShip.position.lat,
      myShip.position.lng,
      myShip.position.lat,
    );
    // CPA 속도 벡터는 침로(COG) 우선, 방위(heading)는 폴백이다.
    // CPA velocity vectors use course over ground first, heading as fallback.
    myVel = cogSogToVelocity(myShip.cog ?? myShip.heading ?? 0, myShip.speed);
  }

  const now = Date.now();
  let nextShips = state.ships;
  let changed = false;
  const feedAdditions: AlertEntry[] = [];

  // 중복 방지 맵이 계속 자라지 않도록 오래된 항목을 주기적으로 정리한다.
  // Keep the dedupe map bounded by evicting entries past the window.
  if (recentCpaFeedByMmsi.size > 256) {
    for (const [mmsi, at] of recentCpaFeedByMmsi) {
      if (now - at >= CPA_FEED_DEDUPE_MS) recentCpaFeedByMmsi.delete(mmsi);
    }
  }

  for (const id of Object.keys(state.ships)) {
    const ship = state.ships[id];
    const { lat, lng } = ship.position;
    const inRestricted =
      ship.kind === "vessel" && isInRestrictedZone(regionId, lat, lng);

    let nextRisk = ship.risk;
    let nextAlerts = ship.alerts;

    // 제한 구역 지오펜스: 모든 선박에 대해 "밖 → 안" 진입 에지에서만 발생.
    // Restricted-zone geofence: edge-triggered on the outside→inside
    // transition, for every vessel regardless of selection.
    if (inRestricted && ship.inRestrictedZone !== true) {
      const alertId = `geo_${id}_${now}`;
      nextAlerts = [
        ...ship.alerts,
        {
          id: alertId,
          message: RESTRICTED_ZONE_ALERT_MESSAGE,
          severity: "medium",
          timestamp: now,
        },
      ];
      feedAdditions.push({
        id: alertId,
        mmsi: id,
        shipName: ship.name,
        message: RESTRICTED_ZONE_ALERT_MESSAGE,
        severity: "medium",
        timestamp: now,
        kind: "geofence",
      });
    }

    if (
      myShip !== undefined &&
      myPos !== null &&
      myVel !== null &&
      id !== selectedId &&
      ship.kind === "vessel"
    ) {
      const otherPos = latLngToXY(lat, lng, myShip.position.lat);
      const otherVel = cogSogToVelocity(
        ship.cog ?? ship.heading ?? 0,
        ship.speed,
      );
      const cpa = calculateCPA(myPos, myVel, otherPos, otherVel);

      let severity: "safe" | "warning" | "danger" = "safe";
      if (cpa.cpaDistance < 500 && cpa.tcpa > 0 && cpa.tcpa < 360) {
        severity = "danger";
      } else if (cpa.cpaDistance < 1500 && cpa.tcpa > 0 && cpa.tcpa < 720) {
        severity = "warning";
      }
      nextRisk = {
        cpaDistance: cpa.cpaDistance,
        tcpa: cpa.tcpa,
        severity,
      };

      // 선택 선박 기준 CPA 위험은 피드에도 올린다 (MMSI당 5분에 한 번).
      // CPA danger against the selected ship also feeds the global list,
      // deduped per MMSI per 5 minutes.
      if (severity === "danger") {
        const lastFeedAt = recentCpaFeedByMmsi.get(id) ?? 0;
        if (now - lastFeedAt >= CPA_FEED_DEDUPE_MS) {
          recentCpaFeedByMmsi.set(id, now);
          feedAdditions.push({
            id: `cpa_${id}_${now}`,
            mmsi: id,
            shipName: ship.name,
            message: `Close approach: CPA ${Math.round(cpa.cpaDistance)} m / TCPA ${Math.max(1, Math.round(cpa.tcpa / 60))} min`,
            severity: "high",
            timestamp: now,
            kind: "cpa",
          });
        }
      }
    }

    const riskChanged =
      nextRisk?.severity !== ship.risk?.severity ||
      nextRisk?.cpaDistance !== ship.risk?.cpaDistance ||
      nextRisk?.tcpa !== ship.risk?.tcpa;
    const zoneChanged = ship.inRestrictedZone !== inRestricted;
    const alertsChanged = nextAlerts !== ship.alerts;

    if (riskChanged || zoneChanged || alertsChanged) {
      if (nextShips === state.ships) {
        nextShips = { ...state.ships };
      }
      nextShips[id] = {
        ...ship,
        risk: nextRisk,
        inRestrictedZone: inRestricted,
        alerts: nextAlerts,
      };
      changed = true;
    }
  }

  const result: Partial<ShipStore> = {};
  if (changed) result.ships = nextShips;
  if (feedAdditions.length > 0) {
    result.alertFeed = [...feedAdditions, ...state.alertFeed].slice(
      0,
      MAX_ALERT_FEED,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// 스토어
// Store
// ---------------------------------------------------------------------------

export const useShipStore = create<ShipStore>((set, get) => {
  const storeInstance: ShipStore = {
    ships: {},
    selectedShipMmsi: null,
    currentRegion: regions.busan,
    // 함대/설정은 앱 시작 시 localStorage에서 복원한다.
    // Fleet & settings are restored from localStorage at store init.
    fleetMmsis: loadPersistedFleet(),
    activeFleetOnly: false,
    marinaMode: false,
    searchQuery: "",
    mapCenterOverride: null,
    isConnected: false,
    streamStatus: createInitialStreamStatus(),
    alertFeed: [],
    settings: loadPersistedSettings(),
    replayGhost: null,

    upsertShips: (updates: ShipPatch[]) => {
      if (updates.length === 0) return;
      set((state: ShipStore) => {
        const now = Date.now();
        const cutoff = now - SHIP_STALE_MS;
        const nextShips = { ...state.ships };
        let trackedCount = Object.keys(nextShips).length;
        let droppedMessages = 0;
        let changed = false;

        for (const id of Object.keys(nextShips)) {
          const ship = nextShips[id];
          if (
            id !== state.selectedShipMmsi &&
            (ship.lastSeen ?? 0) > 0 &&
            (ship.lastSeen ?? 0) < cutoff
          ) {
            delete nextShips[id];
            trackedCount -= 1;
            changed = true;
          }
        }

        for (const update of updates) {
          const existingData = nextShips[update.id];
          if (existingData === undefined) {
            // 위치가 없는 정적 정보만으로는 선박을 만들지 않는다(0,0 유령 방지).
            // Never create a ship from static-only data (no phantom at 0,0).
            if (update.position === undefined) continue;
            if (trackedCount >= MAX_TRACKED_SHIPS) {
              droppedMessages += 1;
              continue;
            }
          }

          nextShips[update.id] = buildMergedShip(update.id, existingData, {
            ...update,
            lastSeen: update.lastSeen ?? now,
          });

          if (existingData === undefined) {
            trackedCount += 1;
          }
          changed = true;
        }

        if (!changed && droppedMessages === 0) return {};
        return {
          ships: changed ? nextShips : state.ships,
          isConnected: true,
          streamStatus: {
            ...state.streamStatus,
            state: "live",
            error: null,
            lastMessageAt: now,
            reconnectAttempts: 0,
            receivedMessages:
              state.streamStatus.receivedMessages + updates.length,
            droppedMessages:
              state.streamStatus.droppedMessages + droppedMessages,
          },
        };
      });
    },

    updateShip: (
      id: string,
      data: Partial<ShipData>,
      options?: UpdateOptions,
    ) => {
      set((state: ShipStore) => {
        const existingData = state.ships[id];
        const mergedData =
          options?.skipPathRecord === true
            ? {
                ...buildMergedShip(id, existingData, data),
                path: existingData?.path ?? data.path ?? [],
              }
            : buildMergedShip(id, existingData, data);

        return {
          ships: {
            ...state.ships,
            [id]: mergedData,
          },
        };
      });
    },

    selectShip: (mmsi: string | null) => {
      set((state: ShipStore) => {
        if (state.selectedShipMmsi === mmsi) return {};

        // 선택이 바뀌면 모든 선박의 CPA 위험도를 지운다(copy-on-write) —
        // 이전 선택 기준의 낡은 위험 색상이 새 선택 화면에 남지 않도록.
        // When selection changes, clear `risk` on ALL ships (copy-on-write)
        // so stale CPA severities never render for the new selection.
        let nextShips = state.ships;
        let shipsChanged = false;
        for (const id of Object.keys(state.ships)) {
          const ship = state.ships[id];
          if (ship.risk !== undefined) {
            if (!shipsChanged) {
              nextShips = { ...state.ships };
              shipsChanged = true;
            }
            nextShips[id] = { ...ship, risk: undefined };
          }
        }

        return {
          selectedShipMmsi: mmsi,
          // 리플레이 고스트는 이전 선택에 속하므로 함께 정리한다.
          // The replay ghost belongs to the previous selection — clear it too.
          replayGhost: null,
          ...(shipsChanged ? { ships: nextShips } : {}),
        };
      });
    },

    setRegion: (id: Region["id"]) => {
      const regionData = regions[id];
      set({
        currentRegion: regionData,
        ships: {},
        selectedShipMmsi: null,
        mapCenterOverride: null,
        replayGhost: null,
      });
    },

    addToFleet: (mmsi: string) => {
      const fleetList = get().fleetMmsis;
      if (!fleetList.includes(mmsi)) {
        const nextFleet = [...fleetList, mmsi];
        persistFleet(nextFleet);
        set({ fleetMmsis: nextFleet });
      }
    },

    removeFromFleet: (mmsi: string) => {
      set((state: ShipStore) => {
        const nextFleet = state.fleetMmsis.filter((id: string) => id !== mmsi);
        persistFleet(nextFleet);
        return { fleetMmsis: nextFleet };
      });
    },

    setFleetMode: (active: boolean) => {
      set({ activeFleetOnly: active });
    },

    setMarinaMode: (active: boolean) => {
      set({ marinaMode: active });
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    setMapCenterOverride: (lat: number, lng: number) => {
      set({ mapCenterOverride: [lat, lng] });
    },

    checkRisks: () => {
      set((state: ShipStore) => computeRiskUpdates(state));
    },

    ackAlert: (mmsi: string, alertId: string) => {
      set((state: ShipStore) => {
        const targetShip = state.ships[mmsi];
        if (targetShip === undefined) return {};

        return {
          ships: {
            ...state.ships,
            [mmsi]: {
              ...targetShip,
              alerts: targetShip.alerts.filter((a) => a.id !== alertId),
            },
          },
        };
      });
    },

    ackFeedAlert: (id: string) => {
      set((state: ShipStore) => {
        const nextFeed = state.alertFeed.filter((entry) => entry.id !== id);
        if (nextFeed.length === state.alertFeed.length) return {};
        return { alertFeed: nextFeed };
      });
    },

    clearAlertFeed: () => {
      set((state: ShipStore) =>
        state.alertFeed.length === 0 ? {} : { alertFeed: [] },
      );
    },

    updateSettings: (patch: Partial<AppSettings>) => {
      set((state: ShipStore) => {
        const nextSettings = sanitizeSettings({ ...state.settings, ...patch });
        persistSettings(nextSettings);
        return { settings: nextSettings };
      });
    },

    setReplayGhost: (ghost: ReplayGhost | null) => {
      set({ replayGhost: ghost });
    },

    pruneStaleShips: () => {
      set((state: ShipStore) => {
        const cutoff = Date.now() - SHIP_STALE_MS;
        const nextShips: Record<string, ShipData> = {};
        let changed = false;

        for (const [id, ship] of Object.entries(state.ships)) {
          const shouldKeep =
            id === state.selectedShipMmsi ||
            (ship.lastSeen ?? 0) === 0 ||
            (ship.lastSeen ?? 0) >= cutoff;

          if (shouldKeep) {
            nextShips[id] = ship;
          } else {
            changed = true;
          }
        }

        if (!changed) return {};
        return { ships: nextShips };
      });
    },
  };
  return storeInstance;
});

export const matchShipQuery = (ship: ShipData, query: string): boolean => {
  if (query === "") return true;
  const queryLower = query.toLowerCase();
  return (
    ship.name.toLowerCase().includes(queryLower) ||
    ship.id.toLowerCase().includes(queryLower) ||
    ship.type.toLowerCase().includes(queryLower) ||
    (ship.callsign ?? "").toLowerCase().includes(queryLower) ||
    (ship.destination ?? "").toLowerCase().includes(queryLower)
  );
};

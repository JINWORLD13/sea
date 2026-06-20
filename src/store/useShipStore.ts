import { create } from "zustand";
import {
  latLngToXY,
  cogSogToVelocity,
  calculateCPA,
} from "../utils/maritimeMath";

export type RegionBounds = [number, number, number, number];

export interface ShipData {
  id: string;
  name: string;
  type: string;
  position: { lat: number; lng: number };
  heading: number;
  speed: number;
  fuel: number | null;
  motion: { pitch: number; roll: number } | null;
  wind: { speed: number; direction: number } | null;
  path: { lat: number; lng: number }[];
  imo?: string;
  destination?: string;
  risk?: {
    cpaDistance: number;
    tcpa: number;
    severity: "safe" | "warning" | "danger";
  };
  inRestrictedZone?: boolean;
  alerts: {
    id: string;
    message: string;
    severity: "low" | "medium" | "high";
    timestamp: number;
  }[];
  historicalData: {
    timestamp: number;
    fuel: number;
    efficiency: number;
  }[];
  lastSeen?: number;
}

export interface Region {
  id: "busan" | "incheon" | "singapore";
  name: string;
  center: [number, number];
  bounds: RegionBounds;
}

export interface AisStreamStatus {
  state: "idle" | "connecting" | "live" | "error";
  error: string | null;
  bounds: RegionBounds | null;
  lastMessageAt: number | null;
  receivedMessages: number;
  droppedMessages: number;
  trackedShipLimit: number;
}

interface UpdateOptions {
  skipPathRecord?: boolean;
}

type ShipPatch = Partial<Omit<ShipData, "id">> & {
  id: string;
};

interface ShipStore {
  ships: Record<string, ShipData>;
  selectedShipMmsi: string | null;
  currentRegion: Region;
  fleetMmsis: string[];
  activeFleetOnly: boolean;
  marinaMode: boolean;
  searchQuery: string;
  mapCenterOverride: [number, number] | null;
  isConnected: boolean;
  streamStatus: AisStreamStatus;

  upsertShips: (updates: ShipPatch[]) => void;
  updateShip: (
    id: string,
    data: Partial<ShipData>,
    options?: UpdateOptions,
  ) => void;
  selectShip: (mmsi: string | null) => void;
  setRegion: (id: Region["id"]) => void;
  addToFleet: (mmsi: string) => void;
  removeFromFleet: (mmsi: string) => void;
  setFleetMode: (active: boolean) => void;
  setMarinaMode: (active: boolean) => void;
  setSearchQuery: (query: string) => void;
  setMapCenterOverride: (lat: number, lng: number) => void;
  checkRisks: () => void;
  ackAlert: (mmsi: string, alertId: string) => void;
  pruneStaleShips: () => void;
}

const MAX_TRACKED_SHIPS = 500;
const MAX_PATH_POINTS = 50;
const SHIP_STALE_MS = 20 * 60 * 1000;
const AIS_FLUSH_INTERVAL_MS = 1000;
const LOCAL_SHIP_CACHE_KEY = "vts:last-known-ais-ships:v1";
const LOCAL_CACHE_TTL_MS = 10 * 60 * 1000;
const LOCAL_CACHE_MAX_SHIPS = 500;
const LOCAL_CACHE_PERSIST_DELAY_MS = 1500;

const createInitialStreamStatus = (): AisStreamStatus => ({
  state: "idle",
  error: null,
  bounds: null,
  lastMessageAt: null,
  receivedMessages: 0,
  droppedMessages: 0,
  trackedShipLimit: MAX_TRACKED_SHIPS,
});

const regions: Record<Region["id"], Region> = {
  busan: {
    id: "busan",
    name: "Busan Port",
    center: [35.1028, 129.0403],
    bounds: [34.95, 128.95, 35.2, 129.25],
  },
  incheon: {
    id: "incheon",
    name: "Incheon Port",
    center: [37.4563, 126.5841],
    bounds: [37.3, 126.35, 37.62, 126.82],
  },
  singapore: {
    id: "singapore",
    name: "Singapore Strait",
    center: [1.248, 103.84],
    bounds: [1.12, 103.55, 1.35, 104.15],
  },
};

export const selectDisplayShips = (
  state: ShipStore,
): Record<string, ShipData> => state.ships;

function isSamePosition(
  left: { lat: number; lng: number } | undefined,
  right: { lat: number; lng: number },
): boolean {
  return left?.lat === right.lat && left.lng === right.lng;
}

function buildMergedShip(
  id: string,
  existingData: ShipData | undefined,
  data: Partial<ShipData>,
): ShipData {
  const position = data.position ?? existingData?.position ?? { lat: 0, lng: 0 };
  const lastPathPoint = existingData?.path[existingData.path.length - 1];
  const path =
    data.position && !isSamePosition(lastPathPoint, data.position)
      ? [...(existingData?.path ?? []), data.position].slice(-MAX_PATH_POINTS)
      : (existingData?.path ?? (data.position ? [data.position] : []));

  return {
    id,
    name: data.name ?? existingData?.name ?? "MMSI " + id,
    type: data.type ?? existingData?.type ?? "AIS",
    position,
    heading: data.heading ?? existingData?.heading ?? 0,
    speed: data.speed ?? existingData?.speed ?? 0,
    fuel: data.fuel ?? existingData?.fuel ?? null,
    motion: data.motion ?? existingData?.motion ?? null,
    wind: data.wind ?? existingData?.wind ?? null,
    path,
    imo: data.imo ?? existingData?.imo,
    destination: data.destination ?? existingData?.destination,
    risk: data.risk ?? existingData?.risk,
    inRestrictedZone: data.inRestrictedZone ?? existingData?.inRestrictedZone,
    alerts: data.alerts ?? existingData?.alerts ?? [],
    historicalData: data.historicalData ?? existingData?.historicalData ?? [],
    lastSeen: data.lastSeen ?? existingData?.lastSeen ?? Date.now(),
  };
}

function isShipInsideBounds(ship: ShipData, bounds: RegionBounds): boolean {
  const { lat, lng } = ship.position;
  return (
    lat >= bounds[0] &&
    lat <= bounds[2] &&
    lng >= bounds[1] &&
    lng <= bounds[3]
  );
}

function canUseLocalCache(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadLocalShipCache(bounds: RegionBounds): Record<string, ShipData> {
  if (!canUseLocalCache()) return {};

  try {
    const rawCache = window.localStorage.getItem(LOCAL_SHIP_CACHE_KEY);
    if (!rawCache) return {};
    const parsed = JSON.parse(rawCache) as {
      ships?: ShipData[];
      savedAt?: number;
    };
    const cachedShips = Array.isArray(parsed.ships) ? parsed.ships : [];
    const now = Date.now();
    const nextShips: Record<string, ShipData> = {};

    for (const ship of cachedShips) {
      const lastSeen = ship.lastSeen ?? parsed.savedAt ?? 0;
      if (lastSeen <= 0 || now - lastSeen > LOCAL_CACHE_TTL_MS) continue;
      if (!isShipInsideBounds(ship, bounds)) continue;
      nextShips[ship.id] = {
        ...ship,
        lastSeen,
      };
    }

    return nextShips;
  } catch {
    return {};
  }
}

function persistLocalShipCache(
  ships: Record<string, ShipData>,
  bounds: RegionBounds | null,
): void {
  if (!bounds || !canUseLocalCache()) return;

  try {
    const now = Date.now();
    const cachedShips = Object.values(ships)
      .filter((ship) => {
        const lastSeen = ship.lastSeen ?? 0;
        return (
          lastSeen > 0 &&
          now - lastSeen <= LOCAL_CACHE_TTL_MS &&
          isShipInsideBounds(ship, bounds)
        );
      })
      .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
      .slice(0, LOCAL_CACHE_MAX_SHIPS);

    window.localStorage.setItem(
      LOCAL_SHIP_CACHE_KEY,
      JSON.stringify({ savedAt: now, ships: cachedShips }),
    );
  } catch {
    // Local storage can be disabled or full; live AIS still works without it.
  }
}

function updateRestrictedZoneForAll(
  get: () => ShipStore,
  set: (fn: (state: ShipStore) => Partial<ShipStore>) => void,
): void {
  const state = get();
  set((s) => {
    const nextShips = { ...s.ships };
    let changed = false;

    for (const id of Object.keys(nextShips)) {
      const ship = nextShips[id];
      const { lat, lng } = ship.position;
      const inRestricted =
        state.currentRegion.id === "busan" &&
        lat > 35.08 &&
        lat < 35.1 &&
        lng > 129.0 &&
        lng < 129.05;

      if (ship.inRestrictedZone !== inRestricted) {
        nextShips[id] = { ...ship, inRestrictedZone: inRestricted };
        changed = true;
      }
    }

    if (!changed) return {};
    return { ships: nextShips };
  });
}

function updateCollisionRisksForSelected(
  state: ShipStore,
  updateShip: ShipStore["updateShip"],
): void {
  const selectedId = state.selectedShipMmsi;
  if (selectedId === null) return;
  const myShip = state.ships[selectedId];
  if (myShip === undefined) return;

  const myPos = latLngToXY(
    myShip.position.lat,
    myShip.position.lng,
    myShip.position.lat,
  );
  const myVel = cogSogToVelocity(myShip.heading, myShip.speed);
  const allShips = Object.values(state.ships);

  for (let i = 0; i < allShips.length; i++) {
    const other = allShips[i];
    if (other.id === selectedId) continue;

    const otherPos = latLngToXY(
      other.position.lat,
      other.position.lng,
      myShip.position.lat,
    );
    const otherVel = cogSogToVelocity(other.heading, other.speed);
    const cpa = calculateCPA(myPos, myVel, otherPos, otherVel);

    let riskLevel: "safe" | "warning" | "danger" = "safe";
    if (cpa.cpaDistance < 500 && cpa.tcpa > 0 && cpa.tcpa < 360) {
      riskLevel = "danger";
    } else if (cpa.cpaDistance < 1500 && cpa.tcpa > 0 && cpa.tcpa < 720) {
      riskLevel = "warning";
    }

    updateShip(
      other.id,
      {
        risk: {
          cpaDistance: cpa.cpaDistance,
          tcpa: cpa.tcpa,
          severity: riskLevel,
        },
      },
      { skipPathRecord: true },
    );

    if (state.currentRegion.id === "busan") {
      const { lat, lng } = other.position;
      const inRestricted =
        lat > 35.08 && lat < 35.1 && lng > 129.0 && lng < 129.05;

      if (inRestricted) {
        const hasGeoAlert = other.alerts.some((a) => a.id.startsWith("geo_"));
        if (!hasGeoAlert) {
          updateShip(
            other.id,
            {
              alerts: [
                ...other.alerts,
                {
                  id: "geo_" + Date.now(),
                  message: "Entered Restricted Fishery Zone!",
                  severity: "medium",
                  timestamp: Date.now(),
                },
              ],
            },
            { skipPathRecord: true },
          );
        }
      }
    }
  }
}

export const useShipStore = create<ShipStore>((set, get) => {
  const storeInstance: ShipStore = {
    ships: {},
    selectedShipMmsi: null,
    currentRegion: regions.busan,
    fleetMmsis: [],
    activeFleetOnly: false,
    marinaMode: false,
    searchQuery: "",
    mapCenterOverride: null,
    isConnected: false,
    streamStatus: createInitialStreamStatus(),

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
          if (existingData === undefined && trackedCount >= MAX_TRACKED_SHIPS) {
            droppedMessages += 1;
            continue;
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
      set({ selectedShipMmsi: mmsi });
    },

    setRegion: (id: Region["id"]) => {
      const regionData = regions[id];
      set({
        currentRegion: regionData,
        ships: {},
        selectedShipMmsi: null,
        mapCenterOverride: null,
      });
    },

    addToFleet: (mmsi: string) => {
      const fleetList = get().fleetMmsis;
      if (!fleetList.includes(mmsi)) {
        set({ fleetMmsis: [...fleetList, mmsi] });
      }
    },

    removeFromFleet: (mmsi: string) => {
      set((state: ShipStore) => ({
        fleetMmsis: state.fleetMmsis.filter((id: string) => id !== mmsi),
      }));
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
      updateRestrictedZoneForAll(get, set);
      updateCollisionRisksForSelected(get(), storeInstance.updateShip);
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
    (ship.destination ?? "").toLowerCase().includes(queryLower)
  );
};

let activeSocket: WebSocket | null = null;
let activeBounds: RegionBounds | null = null;
let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCachePersistTimer: ReturnType<typeof setTimeout> | null = null;
let debugAisMessageCount = 0;
let hasFlushedSinceConnect = false;
const pendingShipUpdates = new Map<string, ShipPatch>();

interface AisPositionPayload {
  Latitude?: unknown;
  Longitude?: unknown;
  Sog?: unknown;
  TrueHeading?: unknown;
  Cog?: unknown;
  COG?: unknown;
}

interface RawAisMessage {
  error?: string;
  message?: string;
  MetaData?: {
    MMSI?: unknown;
    ShipName?: unknown;
  };
  Message?: Record<string, AisPositionPayload | Record<string, unknown>>;
  MessageType?: string;
}

const getProxyWsUrl = (): string => {
  const url = import.meta.env.VITE_PROXY_WS_URL;
  if (url && typeof url === "string") return url;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.VITE_PROXY_HOST || window.location.hostname;
  const port = import.meta.env.VITE_PROXY_PORT || "8080";
  return `${protocol}//${host}:${port}`;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
};

const normalizeHeading = (value: unknown): number | null => {
  const num = toNumber(value);
  if (num === null || num < 0 || num >= 360) return null;
  return Math.round(num);
};

const normalizeSog = (value: unknown): number => {
  const num = toNumber(value);
  if (num === null || num < 0 || num >= 102.3) return 0;
  return num;
};

const isWithinBounds = (lat: number, lng: number, bounds: RegionBounds): boolean =>
  lat >= bounds[0] &&
  lat <= bounds[2] &&
  lng >= bounds[1] &&
  lng <= bounds[3];

const extractPositionPayload = (
  message: RawAisMessage["Message"],
): AisPositionPayload | null => {
  if (!message) return null;
  const candidates = Object.values(message);
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const payload = candidate as AisPositionPayload;
      if (
        typeof payload.Latitude === "number" &&
        typeof payload.Longitude === "number"
      ) {
        return payload;
      }
    }
  }
  return null;
};

const clearPendingUpdates = (): void => {
  if (pendingFlushTimer !== null) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  if (pendingCachePersistTimer !== null) {
    clearTimeout(pendingCachePersistTimer);
    persistLocalShipCache(useShipStore.getState().ships, activeBounds);
    pendingCachePersistTimer = null;
  }
  pendingShipUpdates.clear();
};

const flushPendingShipUpdates = (): void => {
  pendingFlushTimer = null;
  const updates = Array.from(pendingShipUpdates.values());
  pendingShipUpdates.clear();
  if (updates.length > 0) {
    useShipStore.getState().upsertShips(updates);
    scheduleLocalCachePersist();
  }
};

const scheduleLocalCachePersist = (): void => {
  if (pendingCachePersistTimer !== null) {
    clearTimeout(pendingCachePersistTimer);
  }

  pendingCachePersistTimer = setTimeout(() => {
    pendingCachePersistTimer = null;
    persistLocalShipCache(useShipStore.getState().ships, activeBounds);
  }, LOCAL_CACHE_PERSIST_DELAY_MS);
};

const scheduleFlush = (): void => {
  if (pendingFlushTimer !== null) return;
  // 접속 직후 첫 배치(서버 캐시 스냅샷)는 즉시 그려 초기 로딩을 빠르게.
  // 이후에는 1초 간격으로 묶어 렌더 부하를 줄인다.
  // Paint the first batch (server cache snapshot) right away for a fast
  // initial load, then settle into the 1s batching cadence.
  const delay = hasFlushedSinceConnect ? AIS_FLUSH_INTERVAL_MS : 0;
  hasFlushedSinceConnect = true;
  pendingFlushTimer = setTimeout(flushPendingShipUpdates, delay);
};

const markStreamError = (error: string): void => {
  useShipStore.setState((state) => ({
    isConnected: false,
    streamStatus: {
      ...state.streamStatus,
      state: "error",
      error,
    },
  }));
};

export const startAisStream = (bounds: RegionBounds): void => {
  const previousSocket = activeSocket;
  activeSocket = null;
  if (previousSocket !== null) {
    previousSocket.close(1000, "resubscribe");
  }

  clearPendingUpdates();
  activeBounds = bounds;
  debugAisMessageCount = 0;
  hasFlushedSinceConnect = false;
  const cachedShips = loadLocalShipCache(bounds);
  useShipStore.setState({
    ships: cachedShips,
    isConnected: false,
    streamStatus: {
      ...createInitialStreamStatus(),
      state: "connecting",
      bounds,
    },
  });

  const socket = new WebSocket(getProxyWsUrl());
  activeSocket = socket;

  socket.onopen = () => {
    if (activeSocket !== socket) {
      socket.close(1000, "stale socket");
      return;
    }

    useShipStore.setState((state) => ({
      isConnected: true,
      streamStatus: {
        ...state.streamStatus,
        state: "connecting",
        error: null,
      },
    }));

    const subscriptionMsg = {
      BoundingBoxes: [
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
      ],
    };
    socket.send(JSON.stringify(subscriptionMsg));
  };

  socket.onmessage = (event: MessageEvent) => {
    let rawData: RawAisMessage;
    try {
      rawData = JSON.parse(event.data as string) as RawAisMessage;
    } catch {
      return;
    }

    if (rawData.error) {
      markStreamError(rawData.message ?? rawData.error);
      return;
    }

    const positionReport = extractPositionPayload(rawData.Message);
    if (positionReport === null) return;

    const lat = toNumber(positionReport.Latitude);
    const lng = toNumber(positionReport.Longitude);
    if (lat === null || lng === null) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    if (activeBounds !== null && !isWithinBounds(lat, lng, activeBounds)) {
      return;
    }

    const currentMmsi = String(rawData.MetaData?.MMSI ?? "").trim();
    if (!currentMmsi) return;

    const rawShipName = rawData.MetaData?.ShipName;
    const shipName =
      typeof rawShipName === "string" && rawShipName.trim().length > 0
        ? rawShipName.trim()
        : "MMSI " + currentMmsi;

    const heading =
      normalizeHeading(positionReport.TrueHeading) ??
      normalizeHeading(positionReport.Cog) ??
      normalizeHeading(positionReport.COG) ??
      0;

    pendingShipUpdates.set(currentMmsi, {
      id: currentMmsi,
      name: shipName,
      type: "AIS",
      position: { lat, lng },
      speed: normalizeSog(positionReport.Sog),
      heading,
      lastSeen: Date.now(),
    });
    scheduleFlush();

    if (debugAisMessageCount < 5) {
      debugAisMessageCount += 1;
      console.log("[AIS] Position update received", {
        count: debugAisMessageCount,
        mmsi: currentMmsi,
        shipName,
        lat,
        lng,
      });
    }
  };

  socket.onerror = () => {
    if (activeSocket === socket) {
      markStreamError("AIS proxy websocket error");
    }
  };

  socket.onclose = (event) => {
    if (activeSocket !== socket) return;
    activeSocket = null;
    clearPendingUpdates();
    useShipStore.setState((state) => ({
      isConnected: false,
      streamStatus: {
        ...state.streamStatus,
        state: event.code === 1000 ? "idle" : "error",
        error:
          event.code === 1000
            ? null
            : `AIS proxy closed (${event.code || "unknown"})`,
      },
    }));
  };
};

export const stopAisStream = (): void => {
  const socket = activeSocket;
  activeSocket = null;
  activeBounds = null;
  clearPendingUpdates();
  if (socket !== null) {
    socket.close(1000, "client stop");
  }
  useShipStore.setState({
    isConnected: false,
    streamStatus: createInitialStreamStatus(),
  });
};

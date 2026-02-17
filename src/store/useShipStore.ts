// 중앙 저장소: 선박 데이터를 총괄 관리합니다.
// 船舶データを一括管理する中央ストレ이지.
// Central store for managing all ship data.
import { create } from "zustand";
import {
  latLngToXY,
  cogSogToVelocity,
  calculateCPA,
} from "../utils/maritimeMath";

// 선박 상세 정보 인터페이스
// 船舶詳細情報のインターフェース
// Interface for ship details.
export interface ShipData {
  id: string; // MMSI ID
  name: string; // 선박 이름 (船名 / Ship Name)
  type: string; // 선박 종류 (船種 / Ship Type)
  position: { lat: number; lng: number }; // 현재 위치 (現在地 / Current Position)
  heading: number; // 방향 (角度 / Heading)
  speed: number; // 속도 (速度 / Speed)
  fuel: number; // 연료 (燃料 / Fuel)
  motion: { pitch: number; roll: number }; // 흔들림 (揺れ / Motion)
  wind: { speed: number; direction: number }; // 바람 (風 / Wind)
  path: { lat: number; lng: number }[]; // 항적 기록 (航跡 / Path History)
  imo?: string; // 국제해사기구 번호 (IMO번호 / IMO Number)
  destination?: string; // 목적지 (目的地 / Destination)
  risk?: {
    cpaDistance: number;
    tcpa: number;
    severity: "safe" | "warning" | "danger";
  };
  // 지오펜싱: 현재 부산 제한 수역 내 여부 (아이콘 색상용)
  // ジオフェンシング：現在釜山制限水域内か（アイコン色用）
  // Geofencing: whether currently inside Busan restricted zone (for icon color).
  inRestrictedZone?: boolean;
  alerts: {
    id: string;
    message: string;
    severity: "low" | "medium" | "high";
    timestamp: number;
  }[];
  // 분석용 데이터: 연료 효율 및 소비 기록
  // 分析用データ：燃料効率および消費記録
  // Analytics data: Fuel efficiency and consumption history.
  historicalData: {
    timestamp: number;
    fuel: number;
    efficiency: number;
  }[];
}

// 해역 정보 인터페이스
// 海域情報インターフェース
// Interface for region information.
interface Region {
  id: "busan" | "incheon" | "singapore";
  name: string;
  center: [number, number];
  bounds: [number, number, number, number];
}

// 업계 표준 업데이트 옵션 타입
// 業界標準の更新オプション型
// Industry standard update options type.
interface UpdateOptions {
  skipPathRecord?: boolean;
}

// 스토어 인터페이스 정의
// ストアインターフェースの定義
// Store Interface Definition.
interface ShipStore {
  ships: Record<string, ShipData>;
  selectedShipMmsi: string | null;
  currentRegion: Region;
  fleetMmsis: string[];
  activeFleetOnly: boolean;
  marinaMode: boolean;
  searchQuery: string;
  mapCenterOverride: [number, number] | null;
  isAisStreaming: boolean;
  isConnected: boolean;

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
  tick: () => void;
}

// 해역 정보 데이터
// 海域情報データ
// Region Data.
const regions: Record<Region["id"], Region> = {
  busan: {
    id: "busan",
    name: "Busan Port",
    center: [35.1028, 129.0403],
    bounds: [35.0, 128.9, 35.2, 129.2],
  },
  incheon: {
    id: "incheon",
    name: "Incheon Port",
    center: [37.4563, 126.5841],
    bounds: [37.3, 126.4, 37.6, 126.8],
  },
  singapore: {
    id: "singapore",
    name: "Singapore Port",
    center: [1.2901, 103.8519],
    bounds: [1.1, 103.6, 1.4, 104.0],
  },
};

// 운항 가능 구역 (가상 시뮬레이션용) — 육지와 겹치지 않도록 해상만 사용
// 航行可能区域（仮想シミュレーション用）
// Navigable sea zones (for virtual simulation); kept strictly over water to avoid land.
const seaZones: Record<
  Region["id"],
  { minLat: number; maxLat: number; minLng: number; maxLng: number }[]
> = {
  busan: [
    { minLat: 34.96, maxLat: 35.03, minLng: 129.0, maxLng: 129.12 },
    { minLat: 34.97, maxLat: 35.04, minLng: 129.08, maxLng: 129.16 },
  ],
  incheon: [{ minLat: 37.35, maxLat: 37.45, minLng: 126.45, maxLng: 126.65 }],
  singapore: [{ minLat: 1.15, maxLat: 1.25, minLng: 103.65, maxLng: 103.95 }],
};

// 목적항(POD) 목록 — 구체적인 항구명
// 目的港（POD）リスト — 具体的な港名
// Port of Destination (POD) list — specific port names.
const podPorts: string[] = [
  "BUSAN (KR)",
  "INCHEON (KR)",
  "SINGAPORE (SG)",
  "YOKOHAMA (JP)",
  "SHANGHAI (CN)",
  "KAOHSIUNG (TW)",
  "QINGDAO (CN)",
  "OSAKA (JP)",
  "HONG KONG (HK)",
  "NINGBO (CN)",
];

// 데모 선박 데이터 생성기
// デモ船舶データの生成
// Generator for demo ship data.
const generateDemoShips = (
  regionId: Region["id"],
): Record<string, ShipData> => {
  const demoShips: Record<string, ShipData> = {};
  let countShips: number = 0;
  if (regionId === "busan") {
    countShips = 10;
  } else {
    countShips = 6;
  }
  const zonesList = seaZones[regionId];

  for (let i = 0; i < countShips; i++) {
    const zoneItem = zonesList[i % zonesList.length];
    const idValue: string = "999" + regionId.substring(0, 1) + i;
    const latPos: number =
      zoneItem.minLat + Math.random() * (zoneItem.maxLat - zoneItem.minLat);
    const lngPos: number =
      zoneItem.minLng + Math.random() * (zoneItem.maxLng - zoneItem.minLng);

    let shipTypeValue: string = "";
    if (i % 3 === 0) {
      shipTypeValue = "Cargo";
    } else if (i % 3 === 1) {
      shipTypeValue = "Tanker";
    } else {
      shipTypeValue = "Tug";
    }

    const currentFuel = 70 + Math.floor(Math.random() * 30);

    demoShips[idValue] = {
      id: idValue,
      name: "DEMO_" + regionId.toUpperCase() + "_0" + (i + 1),
      type: shipTypeValue,
      position: { lat: latPos, lng: lngPos },
      heading: Math.floor(Math.random() * 360),
      speed: 3 + Math.random() * 12,
      fuel: currentFuel,
      motion: { pitch: 0.5, roll: 1.2 },
      wind: { speed: 12, direction: 45 },
      path: [{ lat: latPos, lng: lngPos }],
      imo: "IMO" + (1000000 + i),
      destination: podPorts[i % podPorts.length],
      alerts: [],
      historicalData: [
        {
          timestamp: Date.now(),
          fuel: currentFuel,
          efficiency: 0.8 + Math.random() * 0.2,
        },
      ],
    };
  }
  return demoShips;
};

// 데모 선박 캐시: selectDisplayShips가 매번 새 객체를 반환하면 무한 리렌더 발생하므로 동일 region이면 같은 참조 반환
// デモ船舶キャッシュ：selectDisplayShipsが毎回新オブジェクトを返すと無限リレンダーになるため同一regionでは同じ参照を返す
// Demo ships cache: return same reference per region to avoid infinite re-renders from getSnapshot.
let displayDemoCache: {
  regionId: Region["id"];
  ships: Record<string, ShipData>;
} | null = null;

export const selectDisplayShips = (
  state: ShipStore,
): Record<string, ShipData> => {
  if (Object.keys(state.ships).length > 0) return state.ships;
  const regionId = state.currentRegion.id;
  if (displayDemoCache && displayDemoCache.regionId === regionId) {
    return displayDemoCache.ships;
  }
  displayDemoCache = {
    regionId,
    ships: generateDemoShips(regionId),
  };
  return displayDemoCache.ships;
};

// 1단계: 모든 선박의 제한 수역(지오펜싱) 여부만 갱신
// ステップ1：全船舶の制限水域（ジオフェンシング）の有無のみ更新
// Step 1: Update only whether each ship is in restricted zone (geofencing).
function updateRestrictedZoneForAll(
  get: () => ShipStore,
  set: (fn: (state: ShipStore) => Partial<ShipStore>) => void,
): void {
  const state = get();
  if (state.currentRegion.id === "busan") {
    set((s) => {
      const nextShips = { ...s.ships };
      for (const id of Object.keys(nextShips)) {
        const ship = nextShips[id];
        const { lat, lng } = ship.position;
        const inRestricted =
          lat > 35.08 && lat < 35.1 && lng > 129.0 && lng < 129.05;
        nextShips[id] = { ...ship, inRestrictedZone: inRestricted };
      }
      return { ships: nextShips };
    });
  } else {
    set((s) => {
      const nextShips = { ...s.ships };
      for (const id of Object.keys(nextShips)) {
        nextShips[id] = { ...nextShips[id], inRestrictedZone: false };
      }
      return { ships: nextShips };
    });
  }
}

// 2단계: 선택된 선박 기준으로 충돌 위험(CPA) 계산 + 부산 제한 수역 알림
// ステップ2：選択船舶基準で衝突リスク（CPA）計算＋釜山制限区域アラート
// Step 2: Calculate collision risk (CPA) for selected ship and add Busan zone alerts.
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
      const lat = other.position.lat;
      const lng = other.position.lng;
      const inRestricted =
        lat > 35.08 && lat < 35.1 && lng > 129.0 && lng < 129.05;
      if (inRestricted === true) {
        const hasGeoAlert = other.alerts.some(
          (a) => a.id.indexOf("geo_") === 0,
        );
        if (hasGeoAlert === false) {
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

// 스토어 본체 (Zustand)
// ストア本体 (Zustand)
// Main Store Instance (Zustand).
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
    isAisStreaming: false,
    isConnected: false,

    // 선박 정보 업데이트 (updateShip)
    // 船舶情報の更新
    // Update ship data.
    updateShip: (
      id: string,
      data: Partial<ShipData>,
      options?: UpdateOptions,
    ) => {
      set((state: ShipStore) => {
        const existingData = state.ships[id];
        if (existingData === undefined) {
          const newShipObj: ShipData = {
            id: id,
            name: data.name || "Unknown",
            type: data.type || "Commercial",
            position: data.position || { lat: 0, lng: 0 },
            heading: data.heading || 0,
            speed: data.speed || 0,
            fuel: data.fuel ?? 85,
            motion: data.motion || { pitch: 0.5, roll: 1.2 },
            wind: data.wind || { speed: 12, direction: 45 },
            path: data.position ? [data.position] : [],
            alerts: [],
            historicalData: [],
            ...data,
          };
          const newShipsMap = { ...state.ships };
          newShipsMap[id] = newShipObj;
          return { ships: newShipsMap };
        }

        const updatedShipObj: ShipData = { ...existingData, ...data };
        if (options?.skipPathRecord !== true && data.position !== undefined) {
          const lastStoredPos = existingData.path[existingData.path.length - 1];
          if (
            lastStoredPos === undefined ||
            lastStoredPos.lat !== data.position.lat ||
            lastStoredPos.lng !== data.position.lng
          ) {
            updatedShipObj.path = [...existingData.path, data.position].slice(
              -50,
            );
          }
        }
        const updatedShipsMap = { ...state.ships };
        updatedShipsMap[id] = updatedShipObj;
        return { ships: updatedShipsMap };
      });
    },

    // 선박 선택 (selectShip)
    // 船舶の選択
    // Select a ship.
    selectShip: (mmsi: string | null) => {
      set({ selectedShipMmsi: mmsi });
    },

    // 해역 변경 (setRegion)
    // 海域の設定
    // Set current region.
    setRegion: (id: Region["id"]) => {
      const regionData = regions[id];
      displayDemoCache = null;
      set({ currentRegion: regionData, ships: {} });
    },

    // 함대에 추가 (addToFleet)
    // 艦隊への追加
    // Add to fleet.
    addToFleet: (mmsi: string) => {
      const fleetList: string[] = get().fleetMmsis;
      if (fleetList.indexOf(mmsi) === -1) {
        set({ fleetMmsis: [...fleetList, mmsi] });
      }
    },

    // 함대에서 제거 (removeFromFleet)
    // 艦隊からの削除
    // Remove from fleet.
    removeFromFleet: (mmsi: string) => {
      set((state: ShipStore) => {
        const filteredList: string[] = state.fleetMmsis.filter((id: string) => {
          const isNotMatch: boolean = id !== mmsi;
          return isNotMatch;
        });
        return { fleetMmsis: filteredList };
      });
    },

    // 함대 모드 설정 (setFleetMode)
    // 艦隊モードの設定
    // Set fleet mode.
    setFleetMode: (active: boolean) => {
      set({ activeFleetOnly: active });
    },

    // 마리나 모드 설정 (setMarinaMode)
    // マリーナモードの設定
    // Set marina mode.
    setMarinaMode: (active: boolean) => {
      set({ marinaMode: active });
    },

    // 검색 쿼리 설정 (setSearchQuery)
    // 検索クエリの設定
    // Set search query.
    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    // 지도 중앙 오버라이드 (선박 선택 시 해당 위치로 지도 이동)
    // 地図中心のオーバーライド（船舶選択時にその位置へ地図移動）
    // Map center override (move map to ship position when selected).
    setMapCenterOverride: (lat: number, lng: number) => {
      set({ mapCenterOverride: [lat, lng] });
    },

    // 충돌 위험 체크: 1) 지오펜싱 갱신 2) CPA 계산 및 알림
    // 衝突リスクチェック：1)ジオフェンシング更新 2)CPA計算とアラート
    // Check risks: 1) update geofencing 2) CPA and alerts.
    checkRisks: () => {
      updateRestrictedZoneForAll(get, set);
      const state = get();
      updateCollisionRisksForSelected(state, storeInstance.updateShip);
    },

    // 알림 확인 (ackAlert)
    // アラートの確認
    // Acknowledge an alert.
    ackAlert: (mmsi: string, alertId: string) => {
      set((state: ShipStore) => {
        const targetShip = state.ships[mmsi];
        if (targetShip === undefined) {
          return state;
        }
        const updatedAlerts = targetShip.alerts.filter((a) => {
          const isNotTargetAlert: boolean = a.id !== alertId;
          return isNotTargetAlert;
        });
        const shipWithAckedAlert: ShipData = {
          ...targetShip,
          alerts: updatedAlerts,
        };
        const newShipsMap = { ...state.ships };
        newShipsMap[mmsi] = shipWithAckedAlert;
        return {
          ships: newShipsMap,
        };
      });
    },

    // 실시간 시뮬레이션 틱 (위치 이동 → 해역 체크 → 연료·히스토리)
    // リアルタイムシミュレーションティック（位置移動→海域チェック→燃料・履歴）
    // Simulation tick: move position, check sea bounds, then fuel & history.
    tick: () => {
      const state = get();
      const regionId = state.currentRegion.id;
      const zones = seaZones[regionId];
      set((s: ShipStore) => {
        const nextShips = { ...s.ships };
        let changed = false;
        const entries = Object.entries(nextShips);
        for (let i = 0; i < entries.length; i++) {
          const id = entries[i][0];
          const ship = entries[i][1];
          if (id.indexOf("999") !== 0) continue;

          // 1) 속도로 다음 위치 계산
          // 1) 速度で次位置を計算
          // 1) Compute next position from speed.
          const moveDelta = ship.speed * 0.000005;
          const headingRad = (ship.heading - 90) * (Math.PI / 180);
          const nextLat = ship.position.lat + Math.cos(headingRad) * moveDelta;
          const nextLng = ship.position.lng + Math.sin(headingRad) * moveDelta;

          // 2) 해역 안인지 체크 (밖이면 방향만 반대로)
          // 2) 海域内かチェック（外なら向きだけ反転）
          // 2) Check if still in sea (if not, just flip heading).
          let inSea = false;
          for (let j = 0; j < zones.length; j++) {
            const z = zones[j];
            if (
              nextLat >= z.minLat &&
              nextLat <= z.maxLat &&
              nextLng >= z.minLng &&
              nextLng <= z.maxLng
            ) {
              inSea = true;
              break;
            }
          }
          if (inSea === false) {
            nextShips[id] = { ...ship, heading: (ship.heading + 180) % 360 };
            changed = true;
            continue;
          }

          // 3) 연료 소모·히스토리 기록
          // 3) 燃料消費・履歴記録
          // 3) Fuel consumption and history.
          const fuelConsumption = (ship.speed / 20) * 0.01;
          const nextFuel = Math.max(0, ship.fuel - fuelConsumption);
          const eff = 0.8 + (Math.random() * 0.2 - 0.1);
          let nextHistory = ship.historicalData || [];
          if (Math.random() > 0.8) {
            nextHistory = [
              ...nextHistory,
              { timestamp: Date.now(), fuel: nextFuel, efficiency: eff },
            ].slice(-30);
          }

          nextShips[id] = {
            ...ship,
            position: { lat: nextLat, lng: nextLng },
            fuel: nextFuel,
            path: [...ship.path, { lat: nextLat, lng: nextLng }].slice(-20),
            historicalData: nextHistory,
          };
          changed = true;
        }
        if (changed) return { ships: nextShips };
        return s;
      });
    },
  };
  return storeInstance;
});

// 검색용 매칭 함수
// 検索用マッチング関数
// Matching function for search.
export const matchShipQuery = (ship: ShipData, query: string): boolean => {
  if (query === "") {
    return true;
  }
  const queryLower: string = query.toLowerCase();
  const nameIncluded: boolean =
    ship.name.toLowerCase().indexOf(queryLower) !== -1;
  const mmsiIncluded: boolean =
    ship.id.toLowerCase().indexOf(queryLower) !== -1;
  const typeIncluded: boolean =
    ship.type.toLowerCase().indexOf(queryLower) !== -1;

  if (nameIncluded === true || mmsiIncluded === true || typeIncluded === true) {
    return true;
  } else {
    return false;
  }
};

let activeSocket: WebSocket | null = null;
let pendingClose = false;

const getProxyWsUrl = (): string => {
  const url = import.meta.env.VITE_PROXY_WS_URL;
  if (url && typeof url === "string") return url;
  // API key flows via proxy; in production use HTTPS so client connects with wss://
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.VITE_PROXY_HOST || window.location.hostname;
  const port = import.meta.env.VITE_PROXY_PORT || "8080";
  return `${protocol}//${host}:${port}`;
};

export const startAisStream = (
  bounds: [number, number, number, number],
): void => {
  if (activeSocket !== null) {
    activeSocket.close();
  }
  pendingClose = false;
  activeSocket = new WebSocket(getProxyWsUrl());
  activeSocket.onopen = () => {
    if (pendingClose && activeSocket) {
      activeSocket.close();
      activeSocket = null;
      return;
    }
    useShipStore.setState({ isConnected: true, ships: {} });
    // AISStream expects [lng, lat] per point: [[minLng, minLat], [maxLng, maxLat]]
    const subscriptionMsg = {
      BoundingBoxes: [
        [
          [bounds[1], bounds[0]],
          [bounds[3], bounds[2]],
        ],
      ],
    };
    const doSend = (): void => {
      if (activeSocket?.readyState === WebSocket.OPEN) {
        activeSocket.send(JSON.stringify(subscriptionMsg));
      } else if (activeSocket?.readyState === WebSocket.CONNECTING) {
        setTimeout(doSend, 10);
      }
    };
    doSend();
  };
  activeSocket.onmessage = (event: MessageEvent) => {
    let rawData: {
      MetaData?: { MMSI?: unknown; ShipName?: string };
      Message?: {
        PositionReport?: {
          Latitude?: number;
          Longitude?: number;
          Sog?: number;
          TrueHeading?: number;
        };
      };
      MessageType?: string;
    };
    try {
      rawData = JSON.parse(event.data as string);
    } catch {
      return;
    }
    if (rawData.MetaData === undefined || rawData.Message === undefined) {
      return;
    }
    const currentMmsi: string = String(rawData.MetaData.MMSI ?? "");
    if (!currentMmsi) return;
    let shipNameStr: string = "";
    if (rawData.MetaData.ShipName) {
      shipNameStr = rawData.MetaData.ShipName.trim();
    } else {
      shipNameStr = "Ship " + currentMmsi;
    }

    if (rawData.MessageType === "PositionReport") {
      const positionReport = rawData.Message.PositionReport;
      if (
        positionReport == null ||
        typeof positionReport.Latitude !== "number" ||
        typeof positionReport.Longitude !== "number"
      ) {
        return;
      }
      const shipStoreState: ShipStore = useShipStore.getState();
      shipStoreState.updateShip(currentMmsi, {
        name: shipNameStr,
        position: {
          lat: positionReport.Latitude,
          lng: positionReport.Longitude,
        },
        speed: typeof positionReport.Sog === "number" ? positionReport.Sog : 0,
        heading:
          typeof positionReport.TrueHeading === "number"
            ? positionReport.TrueHeading
            : 0,
      });
    }
  };
  activeSocket.onerror = () => {
    useShipStore.setState({ isConnected: false });
  };
  activeSocket.onclose = () => {
    activeSocket = null;
    useShipStore.setState({ isConnected: false });
  };
};

// AIS 스트림 정지 (stopAisStream)
// AISストリームの停止
// Stop AIS stream.
export const stopAisStream = (): void => {
  if (activeSocket !== null) {
    if (activeSocket.readyState === WebSocket.CONNECTING) {
      pendingClose = true;
    } else {
      activeSocket.close();
    }
    activeSocket = null;
  }
  useShipStore.setState({ isConnected: false });
};

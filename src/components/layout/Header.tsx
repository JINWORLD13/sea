// 헤더: 검색창(로컬+프록시 캐시 병합), 알림 피드, 지역/스트림 상태를 표시합니다.
// Header: Displays search bar (local + proxy cache merged), alert feed, and region/stream status.
import type { ReactElement, FC, ChangeEvent, KeyboardEvent } from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Bell, Check, Menu, Radio, Search, Trash2, Anchor } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  useShipStore,
  matchShipQuery,
  getProxyHttpUrl,
} from "../../store/useShipStore";
import type {
  AisStreamStatus,
  AlertEntry,
  ShipData,
  ShipKind,
} from "../../store/useShipStore";
import {
  categoryFromTypeCode,
  getCategoryLabelKey,
} from "../../utils/aisTypes";
import { useShipSnapshot } from "../../hooks/useShipSnapshot";

const SEARCH_DEBOUNCE_MS: number = 300;
const MAX_AUTOCOMPLETE_ITEMS: number = 8;
// 프록시 캐시 검색에서 추가로 붙일 최대 항목 수 (Max extra rows appended from the proxy cache search)
const MAX_REMOTE_ITEMS: number = 6;
const MIN_REMOTE_QUERY_LENGTH: number = 2;
const REMOTE_SEARCH_LIMIT: number = 20;
const MAX_BADGE_COUNT: number = 99;
const ALERT_AGE_REFRESH_MS: number = 30_000;

interface HeaderProps {
  // 햄버거 클릭 시 모바일 드로어 열기 (Open the mobile drawer on hamburger click)
  onMenuClick: () => void;
}

// 프록시 GET /search 응답 행 (계약 §1) — Proxy GET /search response row (contract §1)
interface RemoteSearchHit {
  mmsi: string;
  name: string | null;
  lat: number;
  lng: number;
  sog: number | null;
  type: number | null;
  kind: ShipKind;
}

// 로컬/원격 결과를 병합한 표시용 행 — Unified display row merged from local/remote results
interface SearchResultItem {
  mmsi: string;
  name: string;
  categoryKey: string;
  categoryFallback: string;
  speed: number | null;
  lat: number;
  lng: number;
  source: "local" | "remote";
}

// 스트림 상태별 시각 속성 (Visual attributes per stream state)
const STREAM_STATE_META: Record<
  AisStreamStatus["state"],
  { dot: string; text: string; box: string }
> = {
  idle: {
    dot: "bg-slate-500",
    text: "text-slate-400",
    box: "bg-slate-500/10 border-slate-500/30 text-slate-400",
  },
  connecting: {
    dot: "bg-amber-400 animate-pulse",
    text: "text-amber-300",
    box: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  },
  live: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    box: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  },
  reconnecting: {
    dot: "bg-amber-400 animate-pulse",
    text: "text-amber-300",
    box: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  },
  error: {
    dot: "bg-rose-500",
    text: "text-rose-400",
    box: "bg-rose-500/10 border-rose-500/30 text-rose-400",
  },
};

// 심각도 점 색상 (Severity dot colors)
const SEVERITY_DOT: Record<AlertEntry["severity"], string> = {
  high: "bg-rose-500",
  medium: "bg-amber-400",
  low: "bg-sky-400",
};

// 스트림 상태 라벨 (i18n 수집을 위해 리터럴 키 사용) — Stream state label (literal keys so the i18n pass can collect them)
const getStreamStateLabel = (
  t: TFunction,
  state: AisStreamStatus["state"],
): string => {
  switch (state) {
    case "connecting":
      return t("streamConnecting", "Connecting");
    case "live":
      return t("streamLive", "Live");
    case "reconnecting":
      return t("streamReconnecting", "Reconnecting");
    case "error":
      return t("streamError", "Connection error");
    default:
      return t("streamIdle", "Idle");
  }
};

// 알림 경과 시간 포맷 (Format elapsed time for an alert entry)
const formatAlertAge = (t: TFunction, timestamp: number): string => {
  const elapsedSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (elapsedSec < 5) return t("alertAgeJustNow", "just now");
  if (elapsedSec < 60) {
    return t("alertAgeSeconds", "{{value}}s ago", { value: elapsedSec });
  }
  const minutes = Math.floor(elapsedSec / 60);
  if (minutes < 60) {
    return t("alertAgeMinutes", "{{value}}m ago", { value: minutes });
  }
  const hours = Math.floor(minutes / 60);
  return t("alertAgeHours", "{{value}}h ago", { value: hours });
};

const Header: FC<HeaderProps> = ({ onMenuClick }): ReactElement => {
  const { t } = useTranslation();
  const searchQuery: string = useShipStore((state) => state.searchQuery);
  const setSearchQuery = useShipStore((state) => state.setSearchQuery);
  const selectShip = useShipStore((state) => state.selectShip);
  const setMapCenterOverride = useShipStore(
    (state) => state.setMapCenterOverride,
  );
  const currentRegion = useShipStore((state) => state.currentRegion);
  const streamStatus = useShipStore((state) => state.streamStatus);
  const alertFeed = useShipStore((state) => state.alertFeed);
  const ackFeedAlert = useShipStore((state) => state.ackFeedAlert);
  const clearAlertFeed = useShipStore((state) => state.clearAlertFeed);

  const [inputValue, setInputValue] = useState<string>(searchQuery);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [remoteResults, setRemoteResults] = useState<RemoteSearchHit[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState<boolean>(false);
  const [isBellOpen, setIsBellOpen] = useState<boolean>(false);
  const [, setAgeTick] = useState<number>(0);

  // 헤더는 오직 검색 자동완성 때문에 선박 목록이 필요하다. 검색어가 비어 있으면
  // searchResults가 항상 []이므로, 그동안 스냅샷을 일시정지해 매초 발생하던
  // 헤더 전체 리렌더를 없앤다. 첫 글자를 입력하면 80ms 안에 재개된다.
  // The header needs the ship list only for search autocomplete. With an empty
  // query searchResults is always [], so the snapshot is paused meanwhile —
  // removing a full header re-render every second. Typing resumes it in 80ms.
  const isSearching = inputValue.trim().length > 0;
  const ships = useShipSnapshot({ delayMs: 1000, pause: !isSearching });

  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색어 입력과 싱크 맞추기
  // Sync input value with store search query.
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // 디바운스 처리된 검색 실행
  // Run search with debounce.
  useEffect(() => {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setSearchQuery(inputValue);
    }, SEARCH_DEBOUNCE_MS);

    const cleanupFunc = () => {
      clearTimeout(timer);
    };
    return cleanupFunc;
  }, [inputValue, setSearchQuery]);

  // 프록시 캐시 검색: 디바운스된 검색어가 바뀔 때마다 /search 를 조회하고 이전 요청은 중단한다.
  // Proxy cache search: query /search whenever the debounced term changes; abort the previous request.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < MIN_REMOTE_QUERY_LENGTH) {
      setRemoteResults([]);
      setIsRemoteLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsRemoteLoading(true);

    fetch(
      `${getProxyHttpUrl()}/search?q=${encodeURIComponent(q)}&limit=${REMOTE_SEARCH_LIMIT}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`search failed: HTTP ${response.status}`);
        }
        return response.json() as Promise<{ results?: RemoteSearchHit[] }>;
      })
      .then((payload) => {
        setRemoteResults(
          Array.isArray(payload.results) ? payload.results : [],
        );
        setIsRemoteLoading(false);
      })
      .catch(() => {
        // 중단된 요청은 무시하고, 실패 시 원격 결과 없이 로컬 결과만 유지한다.
        // Ignore aborted requests; on failure keep local results only.
        if (controller.signal.aborted) return;
        setRemoteResults([]);
        setIsRemoteLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [searchQuery]);

  // 드롭다운 바깥 클릭 시 닫기 (검색 + 알림 공통)
  // Close dropdowns on outside click (search + notifications).
  useEffect(() => {
    if (!isDropdownOpen && !isBellOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(target)) {
        setIsBellOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isDropdownOpen, isBellOpen]);

  // 알림 패널이 열려 있는 동안 경과 시간 표시를 주기적으로 갱신한다.
  // While the alert panel is open, periodically refresh the age labels.
  useEffect(() => {
    if (!isBellOpen) return;
    const timer = window.setInterval(() => {
      setAgeTick((tick) => tick + 1);
    }, ALERT_AGE_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [isBellOpen]);

  // 로컬 스냅샷 즉시 매칭 + 원격 캐시 결과 병합 (MMSI 기준 중복 제거, 로컬 우선)
  // Instant local snapshot matches merged with remote cache hits (dedupe by MMSI, local first).
  const searchResults = useMemo((): SearchResultItem[] => {
    const q = inputValue.trim();
    if (q.length === 0) return [];

    const localItems: SearchResultItem[] = Object.values(ships)
      .filter((ship: ShipData) => matchShipQuery(ship, inputValue))
      .slice(0, MAX_AUTOCOMPLETE_ITEMS)
      .map((ship: ShipData) => ({
        mmsi: ship.id,
        name: ship.name,
        categoryKey: getCategoryLabelKey(ship.category),
        categoryFallback: ship.category,
        speed: ship.speed,
        lat: ship.position.lat,
        lng: ship.position.lng,
        source: "local" as const,
      }));

    const seenMmsis = new Set<string>(localItems.map((item) => item.mmsi));
    const remoteItems: SearchResultItem[] = [];
    for (const hit of remoteResults) {
      if (seenMmsis.has(hit.mmsi)) continue;
      seenMmsis.add(hit.mmsi);
      const category = categoryFromTypeCode(hit.type, hit.kind);
      remoteItems.push({
        mmsi: hit.mmsi,
        name: hit.name ?? `MMSI ${hit.mmsi}`,
        categoryKey: getCategoryLabelKey(category),
        categoryFallback: category,
        speed: hit.sog,
        lat: hit.lat,
        lng: hit.lng,
        source: "remote" as const,
      });
      if (remoteItems.length >= MAX_REMOTE_ITEMS) break;
    }

    return [...localItems, ...remoteItems];
  }, [ships, inputValue, remoteResults]);

  const showDropdown = isDropdownOpen && inputValue.trim().length > 0;

  const handleSelectResult = (item: SearchResultItem): void => {
    // 원격 전용 결과도 동일: 지도 중심 이동 후 선택 (선박은 이후 스트림으로 채워질 수 있음)
    // Same for remote-only hits: recenter the map, then select (the ship may be filled in by the stream later).
    setMapCenterOverride(item.lat, item.lng);
    selectShip(item.mmsi);
    setInputValue("");
    setSearchQuery("");
    setRemoteResults([]);
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = (): void => {
    if (inputValue.trim().length > 0) setIsDropdownOpen(true);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const newValue: string = event.target.value;
    setInputValue(newValue);
    if (newValue.trim().length > 0) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === "Enter" && searchResults.length > 0) {
      event.preventDefault();
      handleSelectResult(searchResults[0]);
    }
  };

  const streamMeta = STREAM_STATE_META[streamStatus.state];
  const streamLabel = getStreamStateLabel(t, streamStatus.state);
  const reconnectSuffix =
    streamStatus.state === "reconnecting" && streamStatus.reconnectAttempts > 0
      ? ` (${streamStatus.reconnectAttempts})`
      : "";
  const alertCount = alertFeed.length;

  /**
   * [KO]
   * <header(헤더)>
   *  <div(왼쪽 섹션)>
   *    <button(모바일 메뉴 — 드로어 열기)>
   *    <div(검색창 영역 — 로컬 + 캐시 병합 자동완성)>
   *  </div>
   *  <div(오른쪽 섹션)>
   *    <div(알림 벨 + 알림 피드 드롭다운)>
   *    <div(현재 지역 + 스트림 상태 칩)>
   *  </div>
   * </header>
   */
  /**
   * [JA]
   *  </div>
   *  </div>
   * </header>
   */
  /**
   * [EN]
   * <header(Header)>
   *  <div(Left Section)>
   *    <button(Mobile Menu — opens drawer)>
   *    <div(Search Bar Area — local + cache merged autocomplete)>
   *  </div>
   *  <div(Right Section)>
   *    <div(Notification Bell + alert feed dropdown)>
   *    <div(Current Region + stream status chip)>
   *  </div>
   * </header>
   */

  const headerMarkup: ReactElement = (
    <header className="h-20 bg-slate-900/50 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 lg:px-8 fixed top-0 right-0 left-0 lg:left-64 z-30 backdrop-blur-md">
      <div className="flex items-center gap-3 sm:gap-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={t("openNavigation", "Open navigation menu")}
          className="lg:hidden p-2 hover:bg-white/5 rounded-xl transition-colors"
        >
          <Menu size={24} className="text-slate-400" />
        </button>

        {/* 선박 검색 + 자동완성 (Ship Search + Autocomplete) */}
        <div className="relative" ref={searchRef}>
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"
          />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="pl-12 pr-4 py-2.5 bg-black/20 border border-white/5 rounded-xl text-sm text-white w-48 sm:w-64 lg:w-80 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-medium"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 py-2 w-80 max-w-[calc(100vw-5rem)] bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-md max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="px-4 py-4 text-xs text-slate-500 text-center">
                  {isRemoteLoading
                    ? t("searchingCache", "Searching extended coverage...")
                    : `${t("noVesselsMatch")} "${inputValue.trim()}"`}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {searchResults.map((item) => (
                    <li key={item.mmsi}>
                      <button
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-indigo-500/20 transition-colors border-l-2 border-transparent hover:border-indigo-500"
                      >
                        <div
                          className={
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " +
                            (item.source === "local"
                              ? "bg-indigo-500/20"
                              : "bg-slate-700/40")
                          }
                        >
                          <Anchor
                            size={14}
                            className={
                              item.source === "local"
                                ? "text-indigo-400"
                                : "text-slate-400"
                            }
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">
                              {item.name}
                            </p>
                            {item.source === "remote" && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 border border-white/10 shrink-0">
                                {t("searchCacheBadge", "Cache")}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">
                            MMSI {item.mmsi} ·{" "}
                            {t(item.categoryKey, item.categoryFallback)}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {item.speed !== null
                            ? `${item.speed.toFixed(1)} KN`
                            : "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* 알림 벨 + 알림 피드 (Notification bell + alert feed) */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setIsBellOpen((open) => !open)}
            aria-label={t("notifications")}
            aria-expanded={isBellOpen}
            className="relative p-3 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group"
          >
            <Bell
              size={22}
              className={
                isBellOpen
                  ? "text-indigo-400"
                  : "text-slate-400 group-hover:text-indigo-400"
              }
            />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 leading-none">
                {alertCount > MAX_BADGE_COUNT
                  ? `${MAX_BADGE_COUNT}+`
                  : alertCount}
              </span>
            )}
          </button>

          {isBellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <p className="text-xs font-black text-white uppercase tracking-widest">
                  {t("activeAlerts")}
                </p>
                {alertCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAlertFeed}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={12} />
                    {t("clearAllAlerts", "Clear all")}
                  </button>
                )}
              </div>

              {alertCount === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-slate-500">{t("noAlertsDesc")}</p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {alertFeed.map((entry) => (
                    <li key={entry.id}>
                      <div className="px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors">
                        <span
                          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[entry.severity]}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-white truncate">
                              {entry.shipName}
                            </p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 font-bold uppercase tracking-wider shrink-0">
                              {entry.kind === "geofence"
                                ? t("alertKindGeofence", "Zone")
                                : t("alertKindCpa", "CPA")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                            {entry.message}
                          </p>
                          <p className="text-[10px] text-slate-600 font-mono mt-1">
                            {formatAlertAge(t, entry.timestamp)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => ackFeedAlert(entry.id)}
                          aria-label={t("dismissAlert", "Dismiss alert")}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-white/5 mx-1 hidden sm:block"></div>

        {/* 현재 지역 + 스트림 상태 (Current region + stream status) */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-black text-white uppercase tracking-wider">
              {currentRegion.name}
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${streamMeta.dot}`}
              />
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${streamMeta.text}`}
              >
                {streamLabel}
                {reconnectSuffix}
              </p>
            </div>
          </div>
          <div
            className={`w-12 h-12 border rounded-2xl flex items-center justify-center shadow-lg ${streamMeta.box}`}
            title={`${currentRegion.name} · ${streamLabel}`}
          >
            <Radio size={20} />
          </div>
        </div>
      </div>
    </header>
  );

  return headerMarkup;
};

export default Header;

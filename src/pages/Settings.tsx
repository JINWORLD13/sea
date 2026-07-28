// 설정 페이지: 지도/표시 환경설정, 로컬 데이터 관리, 실시간 연결 상태를 제공합니다.
// Settings Page: Map/display preferences, local data management and live connection status.
import { useCallback, useEffect, useRef, useState } from "react";
import type { FC, ReactElement } from "react";
import {
  Database,
  Gauge,
  Globe,
  Map as MapIcon,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Server,
  Trash2,
  Waves,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getProxyHttpUrl, useShipStore } from "../store/useShipStore";
import type { AppSettings } from "../store/useShipStore";

// 삭제 대상 로컬 캐시 키: 선박 위치 캐시만 지운다.
// 함대 목록("vts:fleet:v1")과 설정("vts:settings:v1")은 절대 건드리지 않는다.
// Local cache keys eligible for clearing: ONLY the last-known vessel cache.
// The fleet list ("vts:fleet:v1") and settings ("vts:settings:v1") are never touched.
const SHIP_CACHE_KEYS: readonly string[] = [
  "vts:last-known-ais-ships:v2",
  // 마이그레이션 잔여물인 구버전 키도 함께 정리한다.
  // Also sweep the legacy v1 key left over from the cache migration.
  "vts:last-known-ais-ships:v1",
];

const HEALTH_POLL_INTERVAL_MS = 15_000;
const CLEARED_NOTICE_MS = 4_000;

// 프록시 /health 응답(방어적 파싱: 필드는 모두 선택적).
// Proxy /health response (parsed defensively: every field optional).
interface ProxyHealth {
  ok?: boolean;
  upstreamConnected?: boolean;
  upstreamUptimeMs?: number;
  clients?: number;
  cacheSize?: number;
  lastUpstreamMessageAt?: number | null;
}

type HealthState =
  | { phase: "loading" }
  | { phase: "error"; fetchedAt: number }
  | { phase: "ready"; data: ProxyHealth; fetchedAt: number };

// 언어 이름은 각 언어의 고유 표기이므로 번역 대상이 아니다.
// Language names are endonyms and intentionally not translated.
const LANGUAGE_OPTIONS: readonly { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
];

// 밀리초를 "3h 24m" 형태의 짧은 지속시간 문자열로 변환.
// Format milliseconds as a short duration string like "3h 24m".
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${totalSeconds % 60}s`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h ${totalMinutes % 60}m`;
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

// 접근성을 갖춘 실제 동작하는 토글 스위치(기존의 장식용 div 토글을 대체).
// Accessible, genuinely functional toggle switch (replaces the old decorative div).
const ToggleSwitch: FC<ToggleSwitchProps> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
      checked ? "bg-blue-600" : "bg-slate-200"
    }`}
  >
    <span
      className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

// 세그먼트 컨트롤: 소수의 상호배타 옵션 선택용.
// Segmented control for a small set of mutually exclusive options.
const SegmentedControl: FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  ariaLabel,
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
          option.value === value
            ? "bg-white text-slate-800 shadow-sm border border-slate-200"
            : "border border-transparent text-slate-500 hover:text-slate-700"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

interface SettingRowProps {
  icon: ReactElement;
  title: string;
  description: string;
  control: ReactElement;
}

// 설정 한 줄: 아이콘 + 제목/설명 + 우측 컨트롤.
// One settings row: icon + title/description + trailing control.
const SettingRow: FC<SettingRowProps> = ({ icon, title, description, control }) => (
  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
    <div className="flex items-center gap-3 min-w-0">
      <div className="p-2 bg-slate-100 rounded-lg text-slate-600 shrink-0">{icon}</div>
      <div className="min-w-0">
        <h3 className="font-medium text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
    <div className="shrink-0 sm:ml-4 sm:text-right">{control}</div>
  </div>
);

interface HealthStatProps {
  label: string;
  value: string;
}

const HealthStat: FC<HealthStatProps> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg border border-slate-100 px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="text-sm font-bold text-slate-700 tabular-nums">{value}</p>
  </div>
);

const Settings: FC = (): ReactElement => {
  const { t, i18n } = useTranslation();

  const settings = useShipStore((state) => state.settings);
  const updateSettings = useShipStore((state) => state.updateSettings);
  const currentRegion = useShipStore((state) => state.currentRegion);

  // ── 실시간 연결 패널: 마운트 시 + 15초마다 /health 폴링 ──
  // ── Live connection panel: poll /health on mount + every 15s ──
  const [health, setHealth] = useState<HealthState>({ phase: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  const loadHealth = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`${getProxyHttpUrl()}/health`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as ProxyHealth;
      setHealth({ phase: "ready", data, fetchedAt: Date.now() });
    } catch {
      // 중단(abort)은 언마운트/재요청 시의 정상 흐름이므로 에러로 표시하지 않는다.
      // Aborts are the normal unmount/refetch path — don't surface them as errors.
      if (!controller.signal.aborted) {
        setHealth({ phase: "error", fetchedAt: Date.now() });
      }
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    const timer = window.setInterval(() => {
      void loadHealth();
    }, HEALTH_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [loadHealth]);

  // ── 캐시 삭제: 파괴적 동작이므로 반드시 인라인 2단계 확인을 거친다 ──
  // ── Cache clearing: destructive, so it always goes through an inline confirm ──
  const [confirmingClear, setConfirmingClear] = useState<boolean>(false);
  const [cacheCleared, setCacheCleared] = useState<boolean>(false);
  const clearedTimerRef = useRef<number | null>(null);

  const handleClearShipCache = useCallback((): void => {
    try {
      for (const key of SHIP_CACHE_KEYS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // 스토리지 접근 불가(프라이빗 모드 등)면 조용히 무시한다.
      // Storage unavailable (private mode etc.) — ignore silently.
    }
    setConfirmingClear(false);
    setCacheCleared(true);
    if (clearedTimerRef.current !== null) {
      window.clearTimeout(clearedTimerRef.current);
    }
    clearedTimerRef.current = window.setTimeout(() => {
      setCacheCleared(false);
      clearedTimerRef.current = null;
    }, CLEARED_NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      if (clearedTimerRef.current !== null) {
        window.clearTimeout(clearedTimerRef.current);
      }
    },
    [],
  );

  // 지역 코드(en-US 등)를 기본 언어 코드로 축약해 현재 언어를 판별.
  // Collapse region codes (e.g. en-US) to resolve the active language.
  const currentLanguage = (i18n.language ?? "en").split("-")[0];

  // ── 연결 상태 칩 파생 ──
  // ── Derive the connection status chip ──
  let statusChip: { label: string; className: string; icon: ReactElement };
  if (health.phase === "loading") {
    statusChip = {
      label: t("connChecking", "Checking…"),
      className: "bg-slate-100 text-slate-500 border-slate-200",
      icon: <RefreshCw size={12} className="animate-spin" />,
    };
  } else if (health.phase === "error") {
    statusChip = {
      label: t("connUnreachable", "Proxy unreachable"),
      className: "bg-rose-50 text-rose-600 border-rose-100",
      icon: <WifiOff size={12} />,
    };
  } else if (health.data.upstreamConnected === true) {
    statusChip = {
      label: t("connUpstreamLive", "Upstream live"),
      className: "bg-emerald-50 text-emerald-600 border-emerald-100",
      icon: <Wifi size={12} />,
    };
  } else {
    statusChip = {
      label: t("connUpstreamDown", "Upstream disconnected"),
      className: "bg-amber-50 text-amber-600 border-amber-100",
      icon: <WifiOff size={12} />,
    };
  }

  const healthData: ProxyHealth | null =
    health.phase === "ready" ? health.data : null;
  const lastUpstreamAge =
    health.phase === "ready" &&
    typeof healthData?.lastUpstreamMessageAt === "number"
      ? Math.max(0, health.fetchedAt - healthData.lastUpstreamMessageAt)
      : null;

  /**
   * [KO]
   * <div(컨테이너)>
   *  <h2>제목</h2>
   *  <div(지도/표시 환경설정 카드)>
   *  <div(로컬 데이터 카드)>
   *  <div(실시간 연결 카드)>
   * </div>
   */
  /**
   * [JA]
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <h2>Title</h2>
   *  <div(Map & Display Preferences Card)>
   *  <div(Local Data Card)>
   *  <div(Live Connection Card)>
   * </div>
   */
  const settingsMarkup: ReactElement = (
    <div className="space-y-6 max-w-2xl">
      <title>{`${t("settingsTitle")} - ${t("appName")}`}</title>
      <h2 className="text-2xl font-bold text-white">{t("settingsTitle")}</h2>

      {/*
          지도 및 표시 환경설정 — 모두 settings/updateSettings로 영속화된다.
          Map & display preferences — all persisted via settings/updateSettings.
      */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {t("settingsMapSection", "Map & display")}
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          <SettingRow
            icon={<Globe size={20} />}
            title={t("settingsLanguage", "Language")}
            description={t("settingsLanguageDesc", "Interface language")}
            control={
              <SegmentedControl
                ariaLabel={t("settingsLanguage", "Language")}
                options={LANGUAGE_OPTIONS.map((option) => ({
                  value: option.code,
                  label: option.label,
                }))}
                value={currentLanguage}
                onChange={(code) => {
                  void i18n.changeLanguage(code);
                }}
              />
            }
          />
          <SettingRow
            icon={<Gauge size={20} />}
            title={t("settingsSpeedUnit", "Speed unit")}
            description={t(
              "settingsSpeedUnitDesc",
              "Unit used for vessel speeds across the app",
            )}
            control={
              <SegmentedControl
                ariaLabel={t("settingsSpeedUnit", "Speed unit")}
                options={[
                  { value: "kn", label: t("unitKnots", "Knots") },
                  { value: "kmh", label: t("unitKmh", "km/h") },
                ]}
                value={settings.speedUnit}
                onChange={(value) =>
                  updateSettings({
                    speedUnit: value as AppSettings["speedUnit"],
                  })
                }
              />
            }
          />
          <SettingRow
            icon={<MapIcon size={20} />}
            title={t("settingsBasemap", "Basemap")}
            description={t("settingsBasemapDesc", "Base tile layer for the live map")}
            control={
              <SegmentedControl
                ariaLabel={t("settingsBasemap", "Basemap")}
                options={[
                  { value: "dark", label: t("basemapDark", "Dark") },
                  { value: "light", label: t("basemapLight", "Light") },
                  { value: "osm", label: t("basemapOsm", "Street") },
                  { value: "sat", label: t("basemapSat", "Satellite") },
                ]}
                value={settings.basemap}
                onChange={(value) =>
                  updateSettings({ basemap: value as AppSettings["basemap"] })
                }
              />
            }
          />
          <SettingRow
            icon={<Waves size={20} />}
            title={t("settingsSeamarks", "Seamark overlay")}
            description={t(
              "settingsSeamarksDesc",
              "Show OpenSeaMap buoys, beacons and marks",
            )}
            control={
              <ToggleSwitch
                checked={settings.seamarks}
                onChange={(next) => updateSettings({ seamarks: next })}
                ariaLabel={t("settingsSeamarks", "Seamark overlay")}
              />
            }
          />
          <SettingRow
            icon={<Route size={20} />}
            title={t("settingsTrails", "Vessel trails")}
            description={t(
              "settingsTrailsDesc",
              "Draw the recent track of the selected vessel",
            )}
            control={
              <ToggleSwitch
                checked={settings.showTrails}
                onChange={(next) => updateSettings({ showTrails: next })}
                ariaLabel={t("settingsTrails", "Vessel trails")}
              />
            }
          />
          <SettingRow
            icon={<Navigation size={20} />}
            title={t("settingsCourseVectors", "Course vectors")}
            description={t(
              "settingsCourseVectorsDesc",
              "Project course lines ahead of moving vessels",
            )}
            control={
              <ToggleSwitch
                checked={settings.showCourseVectors}
                onChange={(next) => updateSettings({ showCourseVectors: next })}
                ariaLabel={t("settingsCourseVectors", "Course vectors")}
              />
            }
          />
          <SettingRow
            icon={<MapPin size={20} />}
            title={t("settingsDefaultRegion", "Default region")}
            description={t(
              "settingsDefaultRegionDesc",
              "Monitored region loaded at startup",
            )}
            control={
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {currentRegion.name}
                </p>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  {currentRegion.center[0].toFixed(2)},{" "}
                  {currentRegion.center[1].toFixed(2)}
                </p>
              </div>
            }
          />
        </div>
      </div>

      {/*
          로컬 데이터 — 선박 캐시만 삭제. 함대/설정은 보존된다.
          Local data — clears the vessel cache only. Fleet & settings are kept.
      */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {t("settingsDataSection", "Local data")}
          </h3>
        </div>
        <SettingRow
          icon={<Database size={20} />}
          title={t("clearShipCache", "Clear cached vessel data")}
          description={t(
            "clearShipCacheDesc",
            "Removes locally stored last-known vessel positions. Your fleet list and settings are kept.",
          )}
          control={
            confirmingClear ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  {t("clearShipCacheConfirm", "Clear cached vessel positions?")}
                </span>
                <button
                  type="button"
                  onClick={handleClearShipCache}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  {t("clearShipCacheYes", "Yes, clear")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  {t("clearShipCacheNo", "Cancel")}
                </button>
              </div>
            ) : cacheCleared ? (
              <span className="text-xs font-bold text-emerald-600">
                {t("clearShipCacheDone", "Cached vessel data cleared")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 transition-colors"
              >
                <Trash2 size={14} />
                {t("clearShipCache", "Clear cached vessel data")}
              </button>
            )
          }
        />
      </div>

      {/*
          실시간 연결 — 프록시 /health를 15초마다 조회해 그대로 보여준다(가짜 상태 없음).
          Live connection — polls the proxy /health every 15s and shows it as-is (no fake status).
      */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {t("settingsConnectionSection", "Live connection")}
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${statusChip.className}`}
            >
              {statusChip.icon}
              {statusChip.label}
            </span>
            <button
              type="button"
              onClick={() => {
                void loadHealth();
              }}
              aria-label={t("connRefresh", "Refresh")}
              title={t("connRefresh", "Refresh")}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Server size={14} className="text-slate-400 shrink-0" />
            <span className="font-bold uppercase tracking-widest text-slate-400 text-[10px]">
              {t("connEndpoint", "Endpoint")}
            </span>
            <code className="font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
              {getProxyHttpUrl()}/health
            </code>
          </div>

          {health.phase === "error" ? (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {t(
                "connUnreachableHint",
                "Could not reach the AIS proxy. Check that the proxy server is running.",
              )}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <HealthStat
                label={t("connCachedVessels", "Cached vessels")}
                value={
                  typeof healthData?.cacheSize === "number"
                    ? healthData.cacheSize.toLocaleString()
                    : "—"
                }
              />
              <HealthStat
                label={t("connClients", "Connected clients")}
                value={
                  typeof healthData?.clients === "number"
                    ? healthData.clients.toLocaleString()
                    : "—"
                }
              />
              <HealthStat
                label={t("connLastUpstream", "Last upstream message")}
                value={
                  lastUpstreamAge !== null
                    ? t("connAgeAgo", "{{age}} ago", {
                        age: formatDuration(lastUpstreamAge),
                      })
                    : "—"
                }
              />
              <HealthStat
                label={t("connUptime", "Upstream uptime")}
                value={
                  typeof healthData?.upstreamUptimeMs === "number" &&
                  healthData.upstreamUptimeMs > 0
                    ? formatDuration(healthData.upstreamUptimeMs)
                    : "—"
                }
              />
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            {t("connPollNote", "Refreshes automatically every 15 seconds")}
          </p>
        </div>
      </div>
    </div>
  );

  return settingsMarkup;
};

export default Settings;

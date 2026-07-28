// 분석 페이지: 현재 세션에서 추적 중인 실제 AIS 데이터를 클라이언트에서 집계해 시각화합니다.
// Analytics Page: Aggregates and visualizes the REAL AIS data tracked in this
// session, computed entirely client-side (honest "live session analytics").
import { useMemo } from "react";
import type { FC, ReactElement, ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Compass,
  Gauge,
  Info,
  PieChart,
  Radio,
  Ship,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useShipSnapshot } from "../hooks/useShipSnapshot";
import { useShipStore } from "../store/useShipStore";
import type { AppSettings, ShipCategory, ShipData } from "../store/useShipStore";
import {
  getCategoryColor,
  getCategoryLabelKey,
  getNavStatusLabelKey,
} from "../utils/aisTypes";

// i18n 키가 아직 번역되기 전에도 읽을 수 있도록 하는 영어 기본값(수집 패스가 키를 채운다).
// English fallbacks so labels stay readable before the i18n pass fills these keys in.
const CATEGORY_LABEL_FALLBACK: Record<ShipCategory, string> = {
  cargo: "Cargo",
  tanker: "Tanker",
  passenger: "Passenger",
  highspeed: "High-speed craft",
  fishing: "Fishing",
  tug: "Tug & pilot",
  pleasure: "Pleasure craft",
  special: "Special craft",
  other: "Other",
  unknown: "Unknown",
  aton: "Aid to navigation",
  base: "Base station",
};

const NAV_STATUS_LABEL_FALLBACK: Record<string, string> = {
  navUnderway: "Under way",
  navAnchored: "At anchor",
  navNotUnderCommand: "Not under command",
  navRestricted: "Restricted manoeuvrability",
  navConstrained: "Constrained by draught",
  navMoored: "Moored",
  navAground: "Aground",
  navFishing: "Engaged in fishing",
  navSailing: "Under sail",
  navUnknown: "Not reported",
};

// 속도 히스토그램 구간(계약 고정: 0-1 / 1-5 / 5-10 / 10-15 / 15+ kn).
// Speed histogram bins (fixed by contract: 0-1 / 1-5 / 5-10 / 10-15 / 15+ kn).
const SPEED_BINS: readonly { label: string; min: number; max: number }[] = [
  { label: "0–1", min: 0, max: 1 },
  { label: "1–5", min: 1, max: 5 },
  { label: "5–10", min: 5, max: 10 },
  { label: "10–15", min: 10, max: 15 },
  { label: "15+", min: 15, max: Number.POSITIVE_INFINITY },
];

// 단일 시리즈 차트(히스토그램/막대)의 단일 색상. 범주 색과 혼동되지 않는 순수 크기 인코딩.
// Single hue for single-series charts (histogram/bars) — pure magnitude encoding,
// never confused with the categorical vessel-type palette.
const SINGLE_SERIES_HUE = "#3b82f6";

const formatSpeed = (sog: number, unit: AppSettings["speedUnit"]): string =>
  unit === "kmh" ? `${(sog * 1.852).toFixed(1)} km/h` : `${sog.toFixed(1)} kn`;

// ── 도넛 차트 기하 헬퍼 (외부 라이브러리 없이 순수 SVG) ──
// ── Donut chart geometry helpers (pure SVG, no external libraries) ──
const polarPoint = (
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
});

const describeArc = (
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

// 상단만 둥근 막대(베이스라인 고정) 경로.
// Bar path rounded only at the data end, anchored to the baseline.
const roundedTopBarPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string => {
  const r = Math.min(radius, height, width / 2);
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
};

interface DonutSlice {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface CategoryDonutProps {
  slices: DonutSlice[];
  total: number;
  centerLabel: string;
  ariaLabel: string;
}

// 선종 도넛: 세그먼트 사이 2px 간격 + 범례의 텍스트/수치가 색상 단독 식별을 보완한다.
// Vessel-type donut: 2px gaps between segments, and the text+count legend ensures
// identity is never carried by color alone (the palette is contract-fixed).
const CategoryDonut: FC<CategoryDonutProps> = ({
  slices,
  total,
  centerLabel,
  ariaLabel,
}) => {
  const size = 200;
  const center = size / 2;
  const radius = 72;
  const strokeWidth = 24;
  // 1px(라디안) 간격을 양쪽에 두어 세그먼트 사이 2px 표면 간격을 만든다.
  // ~1px of padding per side yields a 2px surface gap between segments.
  const padAngle = slices.length > 1 ? 1 / radius : 0;

  let accumulated = -Math.PI / 2;
  const segments: ReactElement[] = [];
  for (const slice of slices) {
    const fraction = slice.count / total;
    const start = accumulated;
    const end = accumulated + fraction * Math.PI * 2;
    accumulated = end;

    if (fraction >= 0.999) {
      // 단일 카테고리가 전부일 때는 원호 대신 완전한 원으로 그린다.
      // A single dominant category renders as a full circle (an arc can't span 360°).
      segments.push(
        <circle
          key={slice.key}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={slice.color}
          strokeWidth={strokeWidth}
        >
          <title>{`${slice.label}: ${slice.count}`}</title>
        </circle>,
      );
      continue;
    }

    const arcStart = start + padAngle;
    const arcEnd = Math.max(end - padAngle, arcStart + 0.005);
    segments.push(
      <path
        key={slice.key}
        d={describeArc(center, center, radius, arcStart, arcEnd)}
        fill="none"
        stroke={slice.color}
        strokeWidth={strokeWidth}
        className="transition-opacity hover:opacity-75"
      >
        <title>{`${slice.label}: ${slice.count}`}</title>
      </path>,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      className="w-44 h-44 shrink-0"
    >
      {segments}
      <text
        x={center}
        y={center - 2}
        textAnchor="middle"
        fill="#1e293b"
        fontSize="30"
        fontWeight="800"
      >
        {total}
      </text>
      <text
        x={center}
        y={center + 18}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="10"
        fontWeight="700"
        letterSpacing="1.5"
      >
        {centerLabel.toUpperCase()}
      </text>
    </svg>
  );
};

interface SpeedHistogramProps {
  bins: { label: string; count: number }[];
  ariaLabel: string;
}

// 속도 히스토그램: 단일 색상 + 각 막대 위 직접 수치 라벨(5개 구간이므로 과밀하지 않음).
// Speed histogram: single hue with direct count labels (only 5 bins, never crowded).
const SpeedHistogram: FC<SpeedHistogramProps> = ({ bins, ariaLabel }) => {
  const width = 360;
  const height = 190;
  const padX = 12;
  const topPad = 26;
  const bottomLabelHeight = 26;
  const gap = 16;
  const baseY = height - bottomLabelHeight;
  const plotHeight = baseY - topPad;
  const barWidth = (width - padX * 2 - gap * (bins.length - 1)) / bins.length;
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="w-full h-auto"
    >
      <line
        x1={padX}
        y1={baseY}
        x2={width - padX}
        y2={baseY}
        stroke="#e2e8f0"
        strokeWidth="1"
      />
      {bins.map((bin, index) => {
        const x = padX + index * (barWidth + gap);
        const barHeight = (bin.count / maxCount) * plotHeight;
        const y = baseY - barHeight;
        return (
          <g key={bin.label} className="transition-opacity hover:opacity-75">
            <title>{`${bin.label} kn: ${bin.count}`}</title>
            {bin.count > 0 ? (
              <path
                d={roundedTopBarPath(x, y, barWidth, barHeight, 4)}
                fill={SINGLE_SERIES_HUE}
              />
            ) : (
              // 0인 구간도 정직하게 2px 스텁으로 표시한다.
              // Zero bins still get an honest 2px stub so the bin visibly exists.
              <rect
                x={x}
                y={baseY - 2}
                width={barWidth}
                height={2}
                fill="#e2e8f0"
              />
            )}
            <text
              x={x + barWidth / 2}
              y={(bin.count > 0 ? y : baseY - 2) - 7}
              textAnchor="middle"
              fill="#475569"
              fontSize="11"
              fontWeight="700"
            >
              {bin.count}
            </text>
            <text
              x={x + barWidth / 2}
              y={baseY + 17}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
            >
              {bin.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

interface ChartCardProps {
  icon: ReactElement;
  title: string;
  children: ReactNode;
}

const ChartCard: FC<ChartCardProps> = ({ icon, title, children }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
    <h3 className="font-bold text-slate-700 mb-5 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

interface StatTileProps {
  icon: ReactElement;
  iconClass: string;
  label: string;
  value: string;
}

const StatTile: FC<StatTileProps> = ({ icon, iconClass, label, value }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl shrink-0 ${iconClass}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-800 tabular-nums truncate">
        {value}
      </p>
    </div>
  </div>
);

const Analytics: FC = (): ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ships = useShipSnapshot({ delayMs: 1200 });
  const alertFeed = useShipStore((state) => state.alertFeed);
  const settings = useShipStore((state) => state.settings);
  const selectShip = useShipStore((state) => state.selectShip);

  // ── 세션 스냅샷으로부터 전 지표를 클라이언트에서 파생 ──
  // ── Derive every metric client-side from the live session snapshot ──
  const analytics = useMemo(() => {
    const all = Object.values(ships);
    const vessels = all.filter((ship) => ship.kind === "vessel");
    const atonCount = all.filter((ship) => ship.kind === "aton").length;
    const baseCount = all.filter((ship) => ship.kind === "base").length;
    const moving = vessels.filter((ship) => ship.speed >= 0.5);
    const avgSpeed =
      moving.length > 0
        ? moving.reduce((acc, ship) => acc + ship.speed, 0) / moving.length
        : null;

    const categoryCounts = new Map<ShipCategory, number>();
    for (const vessel of vessels) {
      categoryCounts.set(
        vessel.category,
        (categoryCounts.get(vessel.category) ?? 0) + 1,
      );
    }
    const categories = [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const speedBins = SPEED_BINS.map((bin) => ({
      label: bin.label,
      count: vessels.filter(
        (ship) => ship.speed >= bin.min && ship.speed < bin.max,
      ).length,
    }));

    const navCounts = new Map<string, number>();
    for (const vessel of vessels) {
      const key = getNavStatusLabelKey(vessel.navStatus);
      navCounts.set(key, (navCounts.get(key) ?? 0) + 1);
    }
    const navRows = [...navCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const fastest: ShipData[] = [...moving]
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 10);

    return {
      vesselCount: vessels.length,
      atonCount,
      baseCount,
      movingCount: moving.length,
      avgSpeed,
      categories,
      speedBins,
      navRows,
      fastest,
    };
  }, [ships]);

  const severityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const entry of alertFeed) {
      counts[entry.severity] += 1;
    }
    return counts;
  }, [alertFeed]);

  const categoryLabel = (category: ShipCategory): string =>
    t(getCategoryLabelKey(category), CATEGORY_LABEL_FALLBACK[category]);

  const donutSlices: DonutSlice[] = analytics.categories.map((entry) => ({
    key: entry.category,
    label: categoryLabel(entry.category),
    color: getCategoryColor(entry.category),
    count: entry.count,
  }));

  const maxNavCount = Math.max(...analytics.navRows.map((row) => row.count), 1);

  const handleOpenShip = (mmsi: string): void => {
    selectShip(mmsi);
    navigate("/dashboard");
  };

  /**
   * [KO]
   * <div(컨테이너)>
   *  <div(헤더: 제목 + 라이브 세션 배지)>
   *  <div(요약 지표 그리드)>
   *  <div(차트 그리드: 선종 도넛 / 속도 분포 / 항해 상태 / 경보 심각도)>
   *  <div(최고 속도 상위 10척 테이블)>
   * </div>
   */
  /**
   * [JA]
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <div(Header: title + live-session badge)>
   *  <div(Summary Metrics Grid)>
   *  <div(Chart Grid: type donut / speed distribution / nav status / alert severity)>
   *  <div(Top-10 Fastest Vessels Table)>
   * </div>
   */
  const analyticsMarkup: ReactElement = (
    <div className="space-y-6">
      <title>{`${t("analyticsTitle")} - ${t("appName")}`}</title>
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {t("analyticsTitle")}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {t(
              "analyticsScopeNote",
              "Computed in your browser from vessels tracked this session — not a historical database",
            )}
          </p>
        </div>
        <div className="text-xs text-indigo-500 font-bold bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          {t("liveSessionAnalytics", "Live session analytics")}
        </div>
      </div>

      {/*
          요약 지표 카드 — 전부 현재 스냅샷에서 계산된 실측치.
          Summary metric tiles — every figure measured from the current snapshot.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<Ship size={22} />}
          iconClass="bg-blue-50 text-blue-600"
          label={t("trackedVessels", "Tracked vessels")}
          value={analytics.vesselCount.toLocaleString()}
        />
        <StatTile
          icon={<Compass size={22} />}
          iconClass="bg-emerald-50 text-emerald-600"
          label={t("movingVessels", "Moving vessels")}
          value={analytics.movingCount.toLocaleString()}
        />
        <StatTile
          icon={<Gauge size={22} />}
          iconClass="bg-indigo-50 text-indigo-600"
          label={t("avgMovingSpeed", "Avg speed (moving)")}
          value={
            analytics.avgSpeed !== null
              ? formatSpeed(analytics.avgSpeed, settings.speedUnit)
              : "—"
          }
        />
        <StatTile
          icon={<AlertTriangle size={22} />}
          iconClass="bg-rose-50 text-rose-600"
          label={t("sessionAlerts", "Session alerts")}
          value={alertFeed.length.toLocaleString()}
        />
      </div>

      {analytics.vesselCount === 0 ? (
        // 정직한 빈 상태: 가짜 데이터 대신 수신 대기 상태를 그대로 보여준다.
        // Honest empty state — no fabricated data while waiting for live AIS traffic.
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl">
            <Radio size={32} />
          </div>
          <p className="text-sm font-bold text-slate-500">
            {t(
              "analyticsEmpty",
              "Waiting for live AIS data — analytics populate as vessels arrive",
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/*
                선종별 선박 수 도넛 + 범례(텍스트/수치로 색상 식별을 보완).
                Vessel count by category — donut plus a text+count legend.
            */}
            <ChartCard
              icon={<PieChart size={18} className="text-indigo-500" />}
              title={t("categoryBreakdown", "Vessels by type")}
            >
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <CategoryDonut
                  slices={donutSlices}
                  total={analytics.vesselCount}
                  centerLabel={t("trackedVessels", "Tracked vessels")}
                  ariaLabel={t("categoryBreakdown", "Vessels by type")}
                />
                <ul className="flex-1 w-full space-y-2">
                  {donutSlices.map((slice) => {
                    const percent = Math.round(
                      (slice.count / analytics.vesselCount) * 100,
                    );
                    return (
                      <li
                        key={slice.key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-200"
                          style={{ backgroundColor: slice.color }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-slate-600 truncate">
                          {slice.label}
                        </span>
                        <span className="ml-auto font-bold text-slate-700 tabular-nums">
                          {slice.count}
                        </span>
                        <span className="w-9 text-right text-slate-400 tabular-nums">
                          {percent}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {(analytics.atonCount > 0 || analytics.baseCount > 0) && (
                <p className="mt-4 pt-3 border-t border-slate-50 text-[11px] text-slate-400">
                  {t("atonCount", "Aids to navigation")}: {analytics.atonCount}
                  {" · "}
                  {t("baseStationCount", "Base stations")}: {analytics.baseCount}
                </p>
              )}
            </ChartCard>

            {/*
                속도 분포 히스토그램(계약 고정 구간, SOG는 노트 기준).
                Speed distribution histogram (contract-fixed bins, SOG in knots).
            */}
            <ChartCard
              icon={<BarChart3 size={18} className="text-blue-500" />}
              title={t("speedDistribution", "Speed distribution")}
            >
              <SpeedHistogram
                bins={analytics.speedBins}
                ariaLabel={t("speedDistribution", "Speed distribution")}
              />
              <p className="mt-2 text-[11px] text-slate-400 text-center">
                {t("speedBinAxis", "Speed over ground (kn)")}
              </p>
            </ChartCard>

            {/*
                항해 상태(NavigationalStatus) 분포 — 수평 막대.
                Navigational status breakdown — horizontal bars.
            */}
            <ChartCard
              icon={<Compass size={18} className="text-emerald-500" />}
              title={t("navStatusBreakdown", "Navigational status")}
            >
              <ul className="space-y-3">
                {analytics.navRows.map((row) => (
                  <li key={row.key} className="flex items-center gap-3 text-xs">
                    <span className="w-40 shrink-0 font-semibold text-slate-600 truncate">
                      {t(row.key, NAV_STATUS_LABEL_FALLBACK[row.key] ?? row.key)}
                    </span>
                    <span className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(row.count / maxNavCount) * 100}%`,
                          backgroundColor: SINGLE_SERIES_HUE,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right font-bold text-slate-700 tabular-nums">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            </ChartCard>

            {/*
                세션 경보 심각도별 집계(전역 alertFeed 기반).
                Session alert counts by severity (from the global alert feed).
            */}
            <ChartCard
              icon={<AlertTriangle size={18} className="text-rose-500" />}
              title={t("alertSeverity", "Alerts by severity")}
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
                  <AlertTriangle size={18} className="mx-auto text-rose-500" />
                  <p className="mt-2 text-2xl font-black text-rose-600 tabular-nums">
                    {severityCounts.high}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
                    {t("severityHigh", "High")}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <AlertCircle size={18} className="mx-auto text-amber-500" />
                  <p className="mt-2 text-2xl font-black text-amber-600 tabular-nums">
                    {severityCounts.medium}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    {t("severityMedium", "Medium")}
                  </p>
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-center">
                  <Info size={18} className="mx-auto text-sky-500" />
                  <p className="mt-2 text-2xl font-black text-sky-600 tabular-nums">
                    {severityCounts.low}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
                    {t("severityLow", "Low")}
                  </p>
                </div>
              </div>
              {alertFeed.length === 0 && (
                <p className="mt-4 text-[11px] text-slate-400 text-center">
                  {t("noAlertsThisSession", "No alerts this session")}
                </p>
              )}
            </ChartCard>
          </div>

          {/*
              최고 속도 상위 10척 — 행 클릭 시 해당 선박 선택 후 대시보드로 이동.
              Top-10 fastest vessels — clicking a row selects the ship and opens the dashboard.
          */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Gauge size={18} className="text-indigo-500" />
                {t("topFastestVessels", "Fastest vessels")}
              </h3>
            </div>
            {analytics.fastest.length === 0 ? (
              <p className="px-6 py-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                {t("noMovingVessels", "No vessels under way right now")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      <th className="px-6 py-3 w-10">#</th>
                      <th className="px-6 py-3">{t("vesselName")}</th>
                      <th className="px-6 py-3">{t("vesselType")}</th>
                      <th className="px-6 py-3 text-right">
                        {t("speed", "Speed")}
                      </th>
                      <th className="px-6 py-3">{t("destination")}</th>
                      <th className="px-6 py-3">{t("mmsi")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.fastest.map((ship, index) => (
                      <tr
                        key={ship.id}
                        tabIndex={0}
                        onClick={() => handleOpenShip(ship.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenShip(ship.id);
                          }
                        }}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer focus:outline-none focus:bg-indigo-50/50"
                      >
                        <td className="px-6 py-3 text-xs font-bold text-slate-400 tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-6 py-3 text-sm font-bold text-slate-700">
                          {ship.name}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: getCategoryColor(ship.category),
                              }}
                              aria-hidden="true"
                            />
                            {categoryLabel(ship.category)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm font-bold text-slate-700 text-right tabular-nums whitespace-nowrap">
                          {formatSpeed(ship.speed, settings.speedUnit)}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-500 truncate max-w-[12rem]">
                          {ship.destination ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-sm font-mono text-slate-400">
                          {ship.id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return analyticsMarkup;
};

export default Analytics;

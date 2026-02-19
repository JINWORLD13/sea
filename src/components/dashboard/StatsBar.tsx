// 상황 통계 바 (선박 수, 상태 범례, 공유·내보내기)
// 状況統計バー（船舶数、状態凡例、共有・エクスポート）
// Status bar: ship count, legend, share & export.
import { Activity, Share2, FileDown } from "lucide-react";
import { useShipStore, selectDisplayShips } from "../../store/useShipStore";
import type { TranslationKey } from "../../constants/translations";

interface StatsBarProps {
  isFleetOnly: boolean;
  shipCountFleet: number;
  shipCountTotal: number;
  t: (key: TranslationKey) => string;
}

const StatsBar = ({
  isFleetOnly,
  shipCountFleet,
  shipCountTotal,
  t,
}: StatsBarProps) => {
  const selectedMmsi = useShipStore((s) => s.selectedShipMmsi);

  const handleShare = () => {
    const url = window.location.origin + "/?mmsi=" + (selectedMmsi || "");
    navigator.clipboard.writeText(url);
    alert(t("shareLinkCopied"));
  };

  const handleExport = () => {
    const store = useShipStore.getState();
    const ships = Object.values(selectDisplayShips(store));
    let csv = "MMSI,Name,Lat,Lng,Speed\n";
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      csv += `${s.id},${s.name},${s.position.lat},${s.position.lng},${s.speed}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const link = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = link;
    a.download = "maritime_report.csv";
    a.click();
  };

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-6 text-xs font-bold tracking-widest uppercase text-slate-400">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-indigo-400" />
          {isFleetOnly ? t("activeFleet") : t("vesselsNearby")}:
          <span className="text-white text-sm ml-1">
            {isFleetOnly ? shipCountFleet : shipCountTotal}
          </span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            {t("atSea")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
            {t("moored")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleShare}
          className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
        >
          <Share2 size={12} />
          {t("share")}
        </button>
        <button
          onClick={handleExport}
          className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
        >
          <FileDown size={12} />
          {t("export")}
        </button>
        <div className="text-xs font-mono text-slate-500">
          {t("aisFeedLabel")}: <span className="text-emerald-500/50">{t("live")}</span>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;

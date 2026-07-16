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

// CSV 필드 이스케이프: 쉼표/따옴표/개행이 포함되면 RFC 4180 방식으로 감싼다.
// CSVフィールドのエスケープ：カンマ／引用符／改行を含む場合はRFC 4180方式で囲む。
// Escape a CSV field per RFC 4180 when it contains commas, quotes or newlines.
const csvField = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

const StatsBar = ({
  isFleetOnly,
  shipCountFleet,
  shipCountTotal,
  t,
}: StatsBarProps) => {
  const selectedMmsi = useShipStore((s) => s.selectedShipMmsi);
  const streamStatus = useShipStore((s) => s.streamStatus);

  const handleShare = () => {
    // 선택 선박이 있으면 ?mmsi= 딥링크를, 없으면 앱 루트 링크를 공유한다.
    // 選択船舶があれば ?mmsi= ディープリンクを、なければアプリのルートを共有。
    // Share a ?mmsi= deep link when a vessel is selected, the app root otherwise.
    const url = selectedMmsi
      ? window.location.origin + "/?mmsi=" + encodeURIComponent(selectedMmsi)
      : window.location.origin + "/";
    // clipboard API는 비보안 컨텍스트/권한 거부 시 throw하거나 reject한다.
    // clipboard API can throw (insecure context) or reject (denied); guard it.
    const onCopied = () => alert(t("shareLinkCopied"));
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(onCopied, () => {
        window.prompt(t("shareLinkCopied"), url);
      });
    } else {
      window.prompt(t("shareLinkCopied"), url);
    }
  };

  const handleExport = () => {
    const store = useShipStore.getState();
    let ships = Object.values(selectDisplayShips(store));
    // 함대 모드에서는 화면 통계와 동일하게 함대 선박만 내보낸다.
    // 艦隊モードでは画面の統計と同様に艦隊船舶のみをエクスポートする。
    // In fleet mode export exactly what the stats show: fleet vessels only.
    if (store.activeFleetOnly && store.fleetMmsis.length > 0) {
      const fleetSet = new Set(store.fleetMmsis);
      ships = ships.filter((ship) => fleetSet.has(ship.id));
    }
    const rows = ["MMSI,Name,Category,Destination,Lat,Lng,SpeedKn"];
    for (const s of ships) {
      rows.push(
        [
          csvField(s.id),
          csvField(s.name),
          csvField(s.category),
          csvField(s.destination ?? ""),
          s.position.lat,
          s.position.lng,
          s.speed,
        ].join(","),
      );
    }
    const csv = rows.join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const link = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = link;
    a.download =
      "maritime_report_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 객체 URL을 즉시 해제해 메모리 누수를 막는다.
    // Revoke the object URL so the blob is not leaked for the page lifetime.
    window.URL.revokeObjectURL(link);
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
          {t("aisFeedLabel")}:{" "}
          <span
            className={
              streamStatus.state === "error"
                ? "text-rose-400"
                : streamStatus.state === "live"
                  ? "text-emerald-400"
                  : "text-amber-400"
            }
          >
            {streamStatus.state.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;

// 운영 모드 선택 버튼 (Fleet / Safety / Marina)
// 運用モード選択ボタン（Fleet / Safety / Marina）
// Operation mode switcher (Fleet / Safety / Marina).
import { Anchor, ShieldAlert, Compass } from "lucide-react";

type ModeId = "fleet" | "safety" | "marina";

interface ModeSwitcherProps {
  platformMode: ModeId;
  onSwitchMode: (mode: ModeId) => void;
  t: (key: string) => string;
}

const ModeSwitcher = ({ platformMode, onSwitchMode, t }: ModeSwitcherProps) => {
  const modes: { id: ModeId; icon: React.ReactNode; labelKey: string; color: string }[] = [
    { id: "fleet", icon: <Anchor />, labelKey: "fleetMgr", color: "indigo" },
    { id: "safety", icon: <ShieldAlert />, labelKey: "safetyRisk", color: "red" },
    { id: "marina", icon: <Compass />, labelKey: "tourism", color: "violet" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {modes.map((m) => {
        let btnClass =
          "p-4 rounded-2xl flex items-center justify-center gap-3 transition-all border ";
        if (platformMode === m.id) {
          btnClass += `bg-${m.color}-500/10 border-${m.color}-500/50 text-${m.color}-400 shadow-[0_0_15px_rgba(var(--${m.color}),0.2)]`;
        } else {
          btnClass += "glass-panel text-slate-400 border-white/5 hover:border-white/10";
        }
        let iconClass = "scale-90 ";
        iconClass += platformMode === m.id ? `text-${m.color}-400` : "text-slate-600";
        return (
          <button
            key={m.id}
            onClick={() => onSwitchMode(m.id)}
            className={btnClass}
          >
            <div className={iconClass}>{m.icon}</div>
            <span className="text-sm font-black uppercase tracking-widest">
              {t(m.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ModeSwitcher;

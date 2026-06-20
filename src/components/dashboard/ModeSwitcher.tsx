// 운영 모드 선택 버튼 (Fleet / Safety / Marina)
// 運用モード選択ボタン（Fleet / Safety / Marina）
// Operation mode switcher (Fleet / Safety / Marina).
import { Anchor, ShieldAlert, Compass } from "lucide-react";
import type { TranslationKey } from "../../constants/translations";

type ModeId = "fleet" | "safety" | "marina";

interface ModeSwitcherProps {
  platformMode: ModeId;
  onSwitchMode: (mode: ModeId) => void;
  t: (key: TranslationKey) => string;
}

// Tailwind JIT는 완전한 클래스 리터럴만 인식하므로 동적 보간 대신 정적 매핑을 쓴다.
// Tailwind JIT only keeps complete literal class strings, so use a static map
// instead of string interpolation (which gets purged → invisible styles).
const ACTIVE_BTN_CLASS: Record<ModeId, string> = {
  fleet:
    "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]",
  safety:
    "bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  marina:
    "bg-violet-500/10 border-violet-500/50 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.2)]",
};
const ACTIVE_ICON_CLASS: Record<ModeId, string> = {
  fleet: "text-indigo-400",
  safety: "text-red-400",
  marina: "text-violet-400",
};

const ModeSwitcher = ({ platformMode, onSwitchMode, t }: ModeSwitcherProps) => {
  const modes: {
    id: ModeId;
    icon: React.ReactNode;
    labelKey: TranslationKey;
  }[] = [
    { id: "fleet", icon: <Anchor />, labelKey: "fleetMgr" },
    { id: "safety", icon: <ShieldAlert />, labelKey: "safetyRisk" },
    { id: "marina", icon: <Compass />, labelKey: "tourism" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {modes.map((m) => {
        let btnClass =
          "p-4 rounded-2xl flex items-center justify-center gap-3 transition-all border ";
        if (platformMode === m.id) {
          btnClass += ACTIVE_BTN_CLASS[m.id];
        } else {
          btnClass += "glass-panel text-slate-400 border-white/5 hover:border-white/10";
        }
        let iconClass = "scale-90 ";
        iconClass += platformMode === m.id ? ACTIVE_ICON_CLASS[m.id] : "text-slate-600";
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

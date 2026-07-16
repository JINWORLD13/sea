// 사이드바 메뉴: 페이지 간 이동을 위한 메뉴를 표시합니다. lg 미만에서는 오프캔버스 드로어로 동작합니다.
// サイドバーメニュー：ページ間の遷移のためのメニューを表示します。lg未満ではオフキャンバスドロワーとして動作します。
// Sidebar Menu: Displays the menu for navigating between pages. Below lg it behaves as an off-canvas drawer.
import type { ReactElement, FC } from "react";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Home, Map, Anchor, Settings, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  // 모바일 드로어 열림 여부 (モバイルドロワーの開閉状態 / Whether the mobile drawer is open)
  open: boolean;
  // 드로어 닫기 콜백 (ドロワーを閉じるコールバック / Callback to close the drawer)
  onClose: () => void;
}

interface NavItem {
  to: string;
  labelKey: string;
  Icon: LucideIcon;
}

// 주 네비게이션 항목 (メインナビゲーション項目 / Primary navigation items)
const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", labelKey: "navDashboard", Icon: Home },
  { to: "/map", labelKey: "navLiveMap", Icon: Map },
  { to: "/fleet", labelKey: "navFleetStatus", Icon: Anchor },
  { to: "/analytics", labelKey: "navAnalytics", Icon: Activity },
];

// NavLink 활성/비활성 클래스 빌더 (NavLinkのアクティブ/非アクティブクラスビルダー / NavLink active/inactive class builder)
const buildNavLinkClass = (navInfo: { isActive: boolean }): string => {
  const baseClass =
    "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
  if (navInfo.isActive === true) {
    return (
      baseClass +
      "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
    );
  }
  return (
    baseClass +
    "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
  );
};

const buildSettingsLinkClass = (navInfo: { isActive: boolean }): string => {
  const baseClass =
    "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
  if (navInfo.isActive === true) {
    return baseClass + "bg-slate-800 text-white";
  }
  return baseClass + "text-slate-500 hover:text-slate-300 hover:bg-white/5";
};

const Sidebar: FC<SidebarProps> = ({ open, onClose }): ReactElement => {
  const { t } = useTranslation();

  // 드로어가 열려 있을 때 Escape 키로 닫기 (ドロワーが開いている時にEscapeキーで閉じる / Close the open drawer with the Escape key)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  /**
   * [KO]
   * <>(프래그먼트)
   *  <div(모바일 백드롭 — 클릭 시 드로어 닫힘, lg 이상 숨김)>
   *  <aside(사이드바 — lg 미만 translate-x 오프캔버스)>
   *   <div(로고 섹션)>
   *   <nav(메뉴네비게이션)>
   *     <ul>
   *       <li><NavLink(대시보드/라이브 맵/함대 상태/분석)></li>
   *     </ul>
   *   </nav>
   *   <div(설정 링크)>
   *  </aside>
   * </>
   */
  /**
   * [JA]
   * <>(フラグメント)
   *  <div(モバイルバックドロップ — クリックでドロワーが閉じる、lg以上では非表示)>
   *  <aside(サイドバー — lg未満はtranslate-xオフキャンバス)>
   *   <div(ロゴセクション)>
   *   <nav(メニューナビゲーション)>
   *     <ul>
   *       <li><NavLink(ダッシュボード/ライブマップ/艦隊ステータス/分析)></li>
   *     </ul>
   *   </nav>
   *   <div(設定リンク)>
   *  </aside>
   * </>
   */
  /**
   * [EN]
   * <>(Fragment)
   *  <div(Mobile Backdrop — click closes drawer, hidden at lg and above)>
   *  <aside(Sidebar — translate-x off-canvas below lg)>
   *   <div(Logo Section)>
   *   <nav(Menu Navigation)>
   *     <ul>
   *       <li><NavLink(Dashboard/Live Map/Fleet Status/Analytics)></li>
   *     </ul>
   *   </nav>
   *   <div(Settings Link)>
   *  </aside>
   * </>
   */

  const sidebarStyleAttr =
    "w-64 bg-slate-900/90 text-white flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl border-r border-white/5 backdrop-blur-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 " +
    (open ? "translate-x-0" : "-translate-x-full");

  return (
    <>
      {/* 모바일 백드롭 (モバイルバックドロップ / Mobile backdrop) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarStyleAttr}>
        <div className="p-6 border-b border-white/5 flex items-center justify-center h-20">
          <h1 className="text-2xl font-black tracking-tighter text-indigo-400">
            {t("appName")}
          </h1>
        </div>

        {/*
          주 네비게이션: 대시보드 / 라이브 맵 / 함대 상태 / 분석
          メインナビゲーション：ダッシュボード / ライブマップ / 艦隊ステータス / 分析
          Primary navigation: Dashboard / Live Map / Fleet Status / Analytics
        */}
        <nav
          className="flex-1 overflow-y-auto py-6"
          aria-label={t("mainNavigation", "Main navigation")}
        >
          <ul className="space-y-2 px-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={buildNavLinkClass}
                  onClick={onClose}
                >
                  <item.Icon size={22} />
                  <span className="text-sm font-bold uppercase tracking-widest">
                    {t(item.labelKey)}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          설정
          設定
          Settings
        */}
        <div className="p-4 border-t border-white/5">
          <NavLink
            to="/settings"
            className={buildSettingsLinkClass}
            onClick={onClose}
          >
            <Settings size={22} />
            <span className="text-sm font-bold uppercase tracking-widest">
              {t("navSettings")}
            </span>
          </NavLink>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

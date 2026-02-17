// 사이드바 메뉴: 페이지 간 이동을 위한 메뉴를 표시합니다.
// サイドバーメニュー：ページ間の遷移のためのメニューを表示します。
// Sidebar Menu: Displays the menu for navigating between pages.
import { NavLink } from "react-router-dom";
import { Home, Map, Anchor, Settings, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

const Sidebar = () => {
  const { t } = useTranslation();
  /**
   * [KO]
   * <aside(사이드바)>
   *  <div(로고 섹션)>
   *  <nav(메뉴네비게이션)>
   *    <ul>
   *      <li><NavLink(대시보드)></li>
   *      <li><NavLink(라이브 맵)></li>
   *      <li><NavLink(함대 상태)></li>
   *      <li><NavLink(분석)></li>
   *    </ul>
   *  </nav>
   *  <div(설정 링크)>
   * </aside>
   */
  /**
   * [JA]
   * <aside(サイドバー)>
   *  <div(ロゴセクション)>
   *  <nav(メニューナビゲーション)>
   *    <ul>
   *      <li><NavLink(ダッシュボード)></li>
   *      <li><NavLink(ライブマップ)></li>
   *      <li><NavLink(艦隊ステータス)></li>
   *      <li><NavLink(分析)></li>
   *    </ul>
   *  </nav>
   *  <div(設定リンク)>
   * </aside>
   */
  /**
   * [EN]
   * <aside(Sidebar)>
   *  <div(Logo Section)>
   *  <nav(Menu Navigation)>
   *    <ul>
   *      <li><NavLink(Dashboard)></li>
   *      <li><NavLink(Live Map)></li>
   *      <li><NavLink(Fleet Status)></li>
   *      <li><NavLink(Analytics)></li>
   *    </ul>
   *  </nav>
   *  <div(Settings Link)>
   * </aside>
   */

  const sidebarStyleAttr =
    "w-64 bg-slate-900/90 text-white flex flex-col h-screen fixed left-0 top-0 z-20 shadow-2xl border-r border-white/5 backdrop-blur-xl";

  return (
    <aside className={sidebarStyleAttr}>
      <div className="p-6 border-b border-white/5 flex items-center justify-center h-20">
        <h1 className="text-2xl font-black tracking-tighter text-indigo-400">
          {t("appName")}
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-2 px-3">
          {/*
            대시보드
            ダッシュボード
            Dashboard
          */}
          <li>
            <NavLink
              to="/dashboard"
              className={(navInfo) => {
                const isActive = navInfo.isActive;
                let classNames =
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
                if (isActive === true) {
                  classNames =
                    classNames +
                    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]";
                } else {
                  classNames =
                    classNames +
                    "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent";
                }
                return classNames;
              }}
            >
              <Home size={22} />
              <span className="text-sm font-bold uppercase tracking-widest">
                {t("navDashboard")}
              </span>
            </NavLink>
          </li>

          {/*
            지도
            地図
            Map
          */}
          <li>
            <NavLink
              to="/map"
              className={(navInfo) => {
                const isActive = navInfo.isActive;
                let classNames =
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
                if (isActive === true) {
                  classNames =
                    classNames +
                    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]";
                } else {
                  classNames =
                    classNames +
                    "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent";
                }
                return classNames;
              }}
            >
              <Map size={22} />
              <span className="text-sm font-bold uppercase tracking-widest">
                {t("navLiveMap")}
              </span>
            </NavLink>
          </li>

          {/*
            함대 관리
            艦隊管理
            Fleet Management
          */}
          <li>
            <NavLink
              to="/fleet"
              className={(navInfo) => {
                const isActive = navInfo.isActive;
                let classNames =
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
                if (isActive === true) {
                  classNames =
                    classNames +
                    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]";
                } else {
                  classNames =
                    classNames +
                    "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent";
                }
                return classNames;
              }}
            >
              <Anchor size={22} />
              <span className="text-sm font-bold uppercase tracking-widest">
                {t("navFleetStatus")}
              </span>
            </NavLink>
          </li>

          {/*
            분석
            分析
            Analytics
          */}
          <li>
            <NavLink
              to="/analytics"
              className={(navInfo) => {
                const isActive = navInfo.isActive;
                let classNames =
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
                if (isActive === true) {
                  classNames =
                    classNames +
                    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]";
                } else {
                  classNames =
                    classNames +
                    "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent";
                }
                return classNames;
              }}
            >
              <Activity size={22} />
              <span className="text-sm font-bold uppercase tracking-widest">
                {t("navAnalytics")}
              </span>
            </NavLink>
          </li>
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
          className={(navInfo) => {
            const isActive = navInfo.isActive;
            let classNames =
              "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ";
            if (isActive === true) {
              classNames = classNames + "bg-slate-800 text-white";
            } else {
              classNames =
                classNames +
                "text-slate-500 hover:text-slate-300 hover:bg-white/5";
            }
            return classNames;
          }}
        >
          <Settings size={22} />
          <span className="text-sm font-bold uppercase tracking-widest">
            {t("navSettings")}
          </span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
